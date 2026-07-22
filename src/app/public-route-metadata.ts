import type { Metadata } from "next";

interface PublicRouteMetadataInput {
  canonical: string;
  description?: string;
  imageUrl?: string;
  title: string;
}

function createPublicRouteMetadata({
  canonical,
  description,
  imageUrl,
  title,
}: PublicRouteMetadataInput): Metadata {
  return {
    alternates: { canonical },
    ...(description ? { description } : {}),
    openGraph: {
      ...(description ? { description } : {}),
      ...(imageUrl ? { images: [{ url: imageUrl }] } : {}),
      title,
      url: canonical,
    },
    title: { absolute: title },
    twitter: {
      ...(description ? { description } : {}),
      ...(imageUrl ? { images: [imageUrl] } : {}),
      title,
    },
  };
}

export { createPublicRouteMetadata, type PublicRouteMetadataInput };
