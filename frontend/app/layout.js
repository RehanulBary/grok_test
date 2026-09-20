import "./globals.css";

export const metadata = {
  title: "Posts Viewer",
  description: "Incoming posts from the grok bot",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
