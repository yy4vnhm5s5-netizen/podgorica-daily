import type { Metadata } from "next";

import { siteConfig } from "@/shared/config/site";

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
  const openGraphImages = imageUrl
    ? [{ url: imageUrl }]
    : [{ height: 675, url: "/og-image.png", width: 1200 }];
  const twitterImages = imageUrl ? [imageUrl] : ["/og-image.png"];

  return {
    alternates: { canonical },
    ...(description ? { description } : {}),
    openGraph: {
      ...(description ? { description } : {}),
      images: openGraphImages,
      locale: "sr_Latn_ME",
      siteName: siteConfig.name,
      title,
      type: "website",
      url: canonical,
    },
    title: { absolute: title },
    twitter: {
      ...(description ? { description } : {}),
      card: "summary_large_image",
      images: twitterImages,
      title,
    },
  };
}

export { createPublicRouteMetadata, type PublicRouteMetadataInput };
