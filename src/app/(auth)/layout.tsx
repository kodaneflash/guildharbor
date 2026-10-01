// import { GridShimmeringDots } from "@/components/grid-shimmering-dots";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main
      id="main-content"
      className="relative isolate min-h-screen"
    >
      {/* <GridShimmeringDots
        gap={25}
        dotSize={3.5}
        speed={80}
        opacity={1}
        colors={["#2a2a2a", "#3b3b3b", "#525252"]}
        background="transparent"
        height="100%"
      /> */}
      <div className="relative z-10">{children}</div>
    </main>
  );
}
