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

export class GetObjectCommand extends S3Command {
  constructor(input) {
    super('GetObjectCommand', input)
  }
}

export class PutObjectCommand extends S3Command {
  constructor(input) {
    super('PutObjectCommand', input)
  }
}

export class DeleteObjectCommand extends S3Command {
  constructor(input) {
    super('DeleteObjectCommand', input)
  }
}

export class ListObjectsV2Command extends S3Command {
  constructor(input) {
    super('ListObjectsV2Command', input)
  }
}

const commandDefinitions = {
  GetObjectCommand: { method: 'GET', target: 'object' },
  PutObjectCommand: { method: 'PUT', target: 'object' },
  DeleteObjectCommand: { method: 'DELETE', target: 'object' },
  ListObjectsV2Command: { method: 'GET', target: 'bucket' },
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

    const query =
      command.name === 'ListObjectsV2Command'
        ? {
            'continuation-token': command.input.ContinuationToken,
            'encoding-type': 'url',
            'list-type': '2',
            'max-keys': command.input.MaxKeys,
            prefix: command.input.Prefix,
          }
        : {}

    return { host, path, query: createCanonicalQuery(query) }
  }

  createSignedRequest(command, definition) {
    const { host, path, query } = this.createRequestTarget(command, definition)
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

    const sortedHeaderNames = Object.keys(headers).sort()
    const canonicalHeaders = `${sortedHeaderNames
      .map((name) => `${name}:${String(headers[name]).trim()}`)
      .join('\n')}\n`
    const signedHeaders = sortedHeaderNames.join(';')

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

    const signature = createHmac(
      'sha256',
      getSignatureKey(this.credentials.secretAccessKey, dateStamp, this.region)
    )
      .update(stringToSign)
      .digest('hex')

    headers.authorization =
      `AWS4-HMAC-SHA256 Credential=${this.credentials.accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`

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
      const errorCode =
        readXmlTag(responseBody, 'Code') || (response.status === 404 ? 'NoSuchKey' : 'S3Error')
      const error = new Error(
        `S3 operation failed: ${response.status} ${response.statusText}\n${responseBody}`
      )
      error.name = errorCode
      error.code = errorCode
      error.status = response.status
      throw error
    }

    const metadata = { httpStatusCode: response.status }
    if (command.name === 'GetObjectCommand') {
      return {
        Body: { transformToString: async () => responseBody },
        $metadata: metadata,
      }
    }
    if (command.name === 'ListObjectsV2Command') {
      return {
        Contents: readXmlTags(responseBody, 'Key').map((key) => ({
          Key: decodeListedKey(key),
        })),
        IsTruncated: readXmlTag(responseBody, 'IsTruncated') === 'true',
        NextContinuationToken: readXmlTag(responseBody, 'NextContinuationToken'),
        $metadata: metadata,
      }
    }

    return { $metadata: metadata }
  }
}
