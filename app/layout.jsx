import { ClerkProvider } from "@clerk/nextjs";
import "./portal.css";

export const metadata = {
  title: "Bleuprint workspace",
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@200;300&amp;family=IBM+Plex+Mono:wght@400;500&amp;family=DM+Sans:wght@400;500&amp;display=swap" />
        </head>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
