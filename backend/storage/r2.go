package storage

import (
	"context"
	"fmt"
	"mime/multipart"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	appconfig "github.com/aguspranyoto/trello-clone/config"
)

// R2Client wraps the S3-compatible Cloudflare R2 client.
type R2Client struct {
	client     *s3.Client
	bucketName string
	publicURL  string
}

// NewR2Client creates a new R2 client from application config.
func NewR2Client(cfg *appconfig.Config) (*R2Client, error) {
	r2Resolver := aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...interface{}) (aws.Endpoint, error) {
		return aws.Endpoint{
			URL: fmt.Sprintf("https://%s.r2.cloudflarestorage.com", cfg.R2AccountID),
		}, nil
	})

	awsCfg, err := config.LoadDefaultConfig(context.TODO(),
		config.WithEndpointResolverWithOptions(r2Resolver),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			cfg.R2AccessKeyID,
			cfg.R2SecretAccessKey,
			"",
		)),
		config.WithRegion("auto"),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to load R2 config: %w", err)
	}

	client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.UsePathStyle = true
	})

	// Public URL uses the custom domain or R2 public bucket URL pattern
	publicURL := fmt.Sprintf("https://pub-%s.r2.dev/%s", cfg.R2AccountID, cfg.R2BucketName)

	return &R2Client{
		client:     client,
		bucketName: cfg.R2BucketName,
		publicURL:  publicURL,
	}, nil
}

// UploadFile uploads a multipart file to R2 and returns the public URL.
func (r *R2Client) UploadFile(ctx context.Context, key string, file multipart.File, size int64, mimeType string) (string, error) {
	_, err := r.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(r.bucketName),
		Key:           aws.String(key),
		Body:          file,
		ContentLength: aws.Int64(size),
		ContentType:   aws.String(mimeType),
	})
	if err != nil {
		return "", fmt.Errorf("failed to upload to R2: %w", err)
	}

	url := fmt.Sprintf("%s/%s", r.publicURL, key)
	return url, nil
}

// DeleteFile removes an object from R2 by key.
func (r *R2Client) DeleteFile(ctx context.Context, key string) error {
	_, err := r.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(r.bucketName),
		Key:    aws.String(key),
	})
	return err
}
