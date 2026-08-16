import { createHash, createHmac } from 'node:crypto'

function sha256(data) {
  return createHash('sha256').update(data).digest('hex')
}

function hmacSha256(key, data) {
  return createHmac('sha256', key).update(data).digest()
}

function getSignatureKey(key, dateStamp, regionName, serviceName) {
  const kDate = hmacSha256('AWS4' + key, dateStamp)
  const kRegion = hmacSha256(kDate, regionName)
  const kService = hmacSha256(kRegion, serviceName)
  const kSigning = hmacSha256(kService, 'aws4_request')
  return kSigning
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
    this.endpoint = config.endpoint
    this.region = config.region || 'us-east-1'
    this.forcePathStyle = config.forcePathStyle ?? true
    this.credentials = config.credentials || {
      accessKeyId: process.env.MINIO_ACCESS_KEY_ID,
      secretAccessKey: process.env.MINIO_SECRET_ACCESS_KEY,
    }
  }

  async send(command) {
    const bucket = command.input.Bucket
    const key = command.input.Key
    const cleanKey = key.replace(/^\//, '')

    let endpointUrl = this.endpoint
    if (!/^https?:\/\//i.test(endpointUrl)) {
      endpointUrl = `http://${endpointUrl}`
    }

    const url = new URL(endpointUrl)
    let requestHost = url.host
    let requestPath = ''

    if (this.forcePathStyle) {
      requestPath = `/${bucket}/${cleanKey}`
    } else {
      requestHost = `${bucket}.${url.host}`
      requestPath = `/${cleanKey}`
    }

    const method =
      command.name === 'PutObjectCommand'
        ? 'PUT'
        : command.name === 'DeleteObjectCommand'
          ? 'DELETE'
          : 'GET'
    const now = new Date()
    const amzDate = now.toISOString().replace(/[:-]/g, '').split('.')[0] + 'Z'
    const dateStamp = amzDate.slice(0, 8)

    const headers = {}
    headers['host'] = requestHost
    headers['x-amz-date'] = amzDate

    let payload = ''
    if (command.name === 'PutObjectCommand') {
      payload = command.input.Body || ''
      if (command.input.ContentType) {
        headers['content-type'] = command.input.ContentType
      }
      if (command.input.CacheControl) {
        headers['cache-control'] = command.input.CacheControl
      }
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
      method,
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n')

    const service = 's3'
    const credentialScope = `${dateStamp}/${this.region}/${service}/aws4_request`
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

    const requestUrl = `${url.protocol}//${requestHost}${requestPath}`
    const fetchOptions = {
      method,
      headers,
    }
    if (method === 'PUT') {
      fetchOptions.body = payload
    }

    const response = await fetch(requestUrl, fetchOptions)

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      const error = new Error(
        `S3 operation failed: ${response.status} ${response.statusText}\n${errorText}`
      )
      error.status = response.status
      error.code = response.status === 404 ? 'NoSuchKey' : 'S3Error'
      throw error
    }

    if (command.name === 'GetObjectCommand') {
      const text = await response.text()
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
  }
}
