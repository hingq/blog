import { createHash, createHmac } from 'node:crypto'

function sha256(data) {
  return createHash('sha256').update(data).digest('hex')
}

function hmacSha256(key, data) {
  return createHmac('sha256', key).update(data).digest()
}

function getSignatureKey(key, dateStamp, regionName) {
  const kDate = hmacSha256(`AWS4${key}`, dateStamp)
  const kRegion = hmacSha256(kDate, regionName)
  const kService = hmacSha256(kRegion, 's3')
  return hmacSha256(kService, 'aws4_request')
}

function encodeRfc3986(value) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  )
}

function encodePath(path) {
  return path
    .split('/')
    .map((segment) => encodeRfc3986(segment))
    .join('/')
}

function createCanonicalQuery(query) {
  return Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => [encodeRfc3986(key), encodeRfc3986(String(value))])
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      if (leftKey !== rightKey) return leftKey < rightKey ? -1 : 1
      if (leftValue === rightValue) return 0
      return leftValue < rightValue ? -1 : 1
    })
    .map(([key, value]) => `${key}=${value}`)
    .join('&')
}

function decodeXml(value) {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&')
}

function readXmlTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))
  return match ? decodeXml(match[1]) : undefined
}

function readXmlTags(xml, tag) {
  return [...xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g'))].map((match) =>
    decodeXml(match[1])
  )
}

function decodeListedKey(key) {
  try {
    return decodeURIComponent(key)
  } catch {
    throw new Error(`S3 returned an invalid encoded object key: ${key}`)
  }
}

class S3Command {
  constructor(name, input) {
    this.name = name
    this.input = input
  }
}

export class GetObjectCommand {
  constructor(input) {
    this.input = input
    this.name = 'GetObjectCommand'
  }
}

export class PutObjectCommand {
  constructor(input) {
    this.input = input
    this.name = 'PutObjectCommand'
  }
}

export class DeleteObjectCommand {
  constructor(input) {
    this.input = input
    this.name = 'DeleteObjectCommand'
  }
}

export class S3Client {
  constructor(config) {
    let endpoint = config.endpoint
    if (!/^https?:\/\//i.test(endpoint)) {
      endpoint = `http://${endpoint}`
    }

    this.endpoint = new URL(endpoint)
    this.region = config.region || 'us-east-1'
    this.forcePathStyle = config.forcePathStyle ?? true
    this.credentials = config.credentials || {
      accessKeyId: process.env.MINIO_ACCESS_KEY_ID,
      secretAccessKey: process.env.MINIO_SECRET_ACCESS_KEY,
    }
  }

  createRequestTarget(command, definition) {
    const bucket = command.input.Bucket
    const key = command.input.Key?.replace(/^\//, '')
    let host = this.endpoint.host
    let path

    if (this.forcePathStyle) {
      const bucketPath = `/${encodeRfc3986(bucket)}`
      path = definition.target === 'object' ? `${bucketPath}/${encodePath(key)}` : bucketPath
    } else {
      host = `${bucket}.${host}`
      path = definition.target === 'object' ? `/${encodePath(key)}` : '/'
    }

    const method =
      command.name === 'PutObjectCommand'
        ? 'PUT'
        : command.name === 'DeleteObjectCommand'
          ? 'DELETE'
          : 'GET'
    const now = new Date()
    const amzDate = `${now.toISOString().replace(/[:-]/g, '').split('.')[0]}Z`
    const dateStamp = amzDate.slice(0, 8)
    const payload = definition.method === 'PUT' ? (command.input.Body ?? '') : ''
    const payloadHash = sha256(payload)
    const headers = {
      host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    }

    if (command.input.ContentType) {
      headers['content-type'] = command.input.ContentType
    }
    if (command.input.CacheControl) {
      headers['cache-control'] = command.input.CacheControl
    }

    const payloadHash = sha256(payload)
    headers['x-amz-content-sha256'] = payloadHash

    // Canonical Request construction
    const canonicalUri = requestPath
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/')
    const canonicalQueryString = ''

    // Sort headers for signing
    const canonicalHeaders =
      Object.keys(headers)
        .sort()
        .map((key) => `${key}:${String(headers[key]).trim()}`)
        .join('\n') + '\n'

    const signedHeaders = Object.keys(headers).sort().join(';')

    const canonicalRequest = [
      definition.method,
      path,
      query,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n')
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      sha256(canonicalRequest),
    ].join('\n')

    const signingKey = getSignatureKey(
      this.credentials.secretAccessKey,
      dateStamp,
      this.region,
      service
    )
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex')

    headers['authorization'] =
      `AWS4-HMAC-SHA256 Credential=${this.credentials.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

    const requestUrl = `${this.endpoint.protocol}//${host}${path}${query ? `?${query}` : ''}`
    return {
      requestUrl,
      options: {
        method: definition.method,
        headers,
        body: definition.method === 'PUT' ? payload : undefined,
      },
    }
  }

  async send(command) {
    const definition = commandDefinitions[command.name]
    if (!definition) {
      throw new Error(`Unsupported S3 command: ${command.name}`)
    }

    const { requestUrl, options } = this.createSignedRequest(command, definition)
    const response = await fetch(requestUrl, options)
    const responseBody = await response.text()

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      const error = new Error(
        `S3 operation failed: ${response.status} ${response.statusText}\n${errorText}`
      )
      error.status = response.status
      throw error
    }

    const metadata = { httpStatusCode: response.status }
    if (command.name === 'GetObjectCommand') {
      return {
        Body: {
          transformToString: async () => text,
        },
        $metadata: {
          httpStatusCode: response.status,
        },
      }
    }

    return {
      $metadata: {
        httpStatusCode: response.status,
      },
    }

    return { $metadata: metadata }
  }
}
