import { S3Client } from '@aws-sdk/client-s3'

function hasMinioBaseConfig(env = process.env) {
  return Boolean(
    env.MINIO_ENDPOINT && env.MINIO_BUCKET && env.MINIO_ACCESS_KEY_ID && env.MINIO_SECRET_ACCESS_KEY
  )
}

function hasMinioObjectConfig({ env = process.env, minioKeyEnvName }) {
  return Boolean(hasMinioBaseConfig(env) && minioKeyEnvName && env[minioKeyEnvName])
}

function getRuntimeContentSource({ env = process.env, remoteUrlEnvName, minioKeyEnvName }) {
  if (hasMinioObjectConfig({ env, minioKeyEnvName })) {
    return 'minio'
  }

  if (remoteUrlEnvName && env[remoteUrlEnvName]) {
    return 'remote'
  }

  return 'local'
}

function createMinioClient(env = process.env) {
  if (!hasMinioBaseConfig(env)) {
    throw new Error('MinIO runtime config is incomplete')
  }

  return new S3Client({
    endpoint: env.MINIO_ENDPOINT,
    region: env.MINIO_REGION || 'us-east-1',
    forcePathStyle: env.MINIO_FORCE_PATH_STYLE !== 'false',
    credentials: {
      accessKeyId: env.MINIO_ACCESS_KEY_ID,
      secretAccessKey: env.MINIO_SECRET_ACCESS_KEY,
    },
  })
}

export { createMinioClient, getRuntimeContentSource, hasMinioObjectConfig }
