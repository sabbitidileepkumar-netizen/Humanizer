import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "HumanFlow AI — Make every word flow naturally",
  description: "An AI-assisted writing workspace for clearer, more natural drafts and careful research refinement.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
