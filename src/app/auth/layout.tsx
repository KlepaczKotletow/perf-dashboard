import type { Metadata } from "next";

// /auth/* contains OAuth callback/error/success pages — never index them.
// robots.txt already Disallows /auth/, but a response-level directive is the
// only way to keep an externally-linked auth URL out of the index.
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
