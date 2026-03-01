import Link from "next/link";
import Image from "next/image";
import TweetEmbed from "./components/TweetEmbed";
import SignInButton from "./components/SignInButton";

// ─── Nav ──────────────────────────────────────────────────────────────────────
function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 landing-bg-nav backdrop-blur-sm px-4 sm:px-6">
      <div className="max-w-7xl mx-auto py-4 sm:py-5">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Image src="/favicon/main.png" alt="Logo" width={24} height={24} className="logo-dark-mode" />
            <span className="text-base sm:text-lg font-semibold tracking-tight">PicToFrontend</span>
          </div>
          <div className="flex items-center gap-3 sm:gap-6">
            <Link href="/roadmap" className="text-sm landing-text-muted hover-line">Roadmap</Link>
            <SignInButton />
            <Link href="/app" className="btn-primary px-4 sm:px-5 py-2 sm:py-2.5 text-sm font-medium">
              <span>Get Started</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

// ─── Hero ──────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="h-[calc((100vh-4rem)/2-2rem)] flex items-center px-6 bg-grid noise-overlay overflow-hidden relative">
      <div className="max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-10 items-center h-full">
          {/* Left */}
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-4">
              <span className="stat-highlight text-sm text-[#2563EB]">71,502</span>
              <span className="text-sm landing-text-muted">stars on GitHub</span>
              <div className="h-px w-12 landing-border border-t" />
            </div>
            <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight leading-[0.9] mb-4">
              Build User<br />Interfaces<br />
              <span className="text-[#2563EB]">10x Faster</span>
            </h1>
            <p className="text-base landing-text-muted max-w-md mb-5 leading-relaxed">
              AI-powered conversion from screenshots and videos to clean, production-ready code.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/app"
                className="btn-primary px-5 py-2.5 text-sm font-medium inline-flex items-center gap-2 group"
              >
                <span>Start Building</span>
                <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 448 512" className="text-xs transition-transform group-hover:translate-x-1" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
                  <path d="M190.5 66.9l22.2-22.2c9.4-9.4 24.6-9.4 33.9 0L441 239c9.4 9.4 9.4 24.6 0 33.9L246.6 467.3c-9.4 9.4-24.6 9.4-33.9 0l-22.2-22.2c-9.5-9.5-9.3-25 .4-34.3L311.4 296H24c-13.3 0-24-10.7-24-24v-32c0-13.3 10.7-24 24-24h287.4L190.9 101.2c-9.8-9.3-10-24.8-.4-34.3z" />
                </svg>
              </Link>
              <a
                href="https://github.com/abi/screenshot-to-code"
                target="_blank"
                rel="noopener noreferrer"
                className="landing-github-btn px-5 py-2.5 text-sm font-medium inline-flex items-center gap-2"
              >
                <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 496 512" className="text-base" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
                  <path d="M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3.3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3zm44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9.3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8zM97.2 352.9c-1.3 1-1 3.3.7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3.3 2.9 2.3 3.9 1.6 1 3.6.7 4.3-.7.7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3.7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3.7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9 1.6 2.3 4.3 3.3 5.6 2.3 1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z" />
                </svg>
                <span>GitHub</span>
                <span className="landing-github-badge text-xs px-2 py-0.5 rounded-full font-mono">71.5k</span>
              </a>
            </div>
          </div>

          {/* Right – Demo video */}
          <div className="hidden lg:block h-full py-4">
            <div className="video-frame h-full">
              <video
                src="/demos/instagram.mp4"
                className="w-full h-full object-cover"
                autoPlay
                loop
                playsInline
                muted
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Video to Code ─────────────────────────────────────────────────────────────
function VideoToCode() {
  return (
    <section className="py-24 px-6 landing-bg">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left – video */}
          <div className="relative order-2 lg:order-1">
            <div className="video-frame">
              <video
                src="/demos/tally-form.mp4"
                className="w-full"
                autoPlay
                loop
                playsInline
                muted
              />
            </div>
          </div>

          {/* Right – text */}
          <div className="order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-[#2563EB]/10 text-[#2563EB]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2563EB] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2563EB]" />
              </span>
              <span className="text-sm font-medium">New Feature</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">Video to Code</h2>
            <p className="text-xl landing-text-muted mb-6 max-w-md leading-relaxed">
              Record your screen showing a full website, app or UI interaction, and watch as our AI transforms it into functional, production-ready code.
            </p>
            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <span className="text-[#2563EB] mt-1">✓</span>
                <span className="landing-text-muted">Capture complex interactions and animations</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#2563EB] mt-1">✓</span>
                <span className="landing-text-muted">AI understands hover states, transitions &amp; flows</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#2563EB] mt-1">✓</span>
                <span className="landing-text-muted">Generate complete interactive components</span>
              </li>
            </ul>
            <Link
              href="/app"
              className="btn-primary px-6 py-3 text-sm font-medium inline-flex items-center gap-2 group"
            >
              <span>Try Video Recording</span>
              <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 448 512" className="text-xs transition-transform group-hover:translate-x-1" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
                <path d="M190.5 66.9l22.2-22.2c9.4-9.4 24.6-9.4 33.9 0L441 239c9.4 9.4 9.4 24.6 0 33.9L246.6 467.3c-9.4 9.4-24.6 9.4-33.9 0l-22.2-22.2c-9.5-9.5-9.3-25 .4-34.3L311.4 296H24c-13.3 0-24-10.7-24-24v-32c0-13.3 10.7-24 24-24h287.4L190.9 101.2c-9.8-9.3-10-24.8-.4-34.3z" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}


// ─── How it works ──────────────────────────────────────────────────────────────
function HowItWorks() {
  return (
    <section className="py-24 px-6 landing-bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">

          {/* Left – sticky */}
          <div className="lg:sticky lg:top-32">
            <div className="accent-line w-16 mb-8" />
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
              Built for the way<br />
              <span className="font-editorial">you work</span>
            </h2>
            <p className="text-xl landing-text-muted mb-8 max-w-md">
              No complex setup. No learning curve. Just paste, click, and ship.
            </p>
            <Link
              href="/app"
              className="btn-primary px-6 py-3 text-sm font-medium inline-flex items-center gap-2 group"
            >
              <span>Try it now</span>
              <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 448 512" className="text-xs transition-transform group-hover:translate-x-1" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
                <path d="M190.5 66.9l22.2-22.2c9.4-9.4 24.6-9.4 33.9 0L441 239c9.4 9.4 9.4 24.6 0 33.9L246.6 467.3c-9.4 9.4-24.6 9.4-33.9 0l-22.2-22.2c-9.5-9.5-9.3-25 .4-34.3L311.4 296H24c-13.3 0-24-10.7-24-24v-32c0-13.3 10.7-24 24-24h287.4L190.9 101.2c-9.8-9.3-10-24.8-.4-34.3z" />
              </svg>
            </Link>
          </div>

          {/* Right – feature cards */}
          <div className="space-y-6">
            <div className="feature-card-unique p-8">
              <div className="flex items-start gap-6">
                <span className="stat-highlight text-3xl opacity-20">01</span>
                <div>
                  <h3 className="text-xl font-semibold mb-2">PicToFrontend</h3>
                  <p className="landing-text-muted leading-relaxed">Drop any screenshot, Figma design, or mockup. Our AI analyzes the visual structure and generates production-ready code.</p>
                </div>
              </div>
            </div>
            <div className="feature-card-unique p-8">
              <div className="flex items-start gap-6">
                <span className="stat-highlight text-3xl opacity-20">02</span>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Framework Agnostic</h3>
                  <p className="landing-text-muted leading-relaxed">Generate code for HTML/CSS, React, Vue, HTML/Tailwind, Bootstrap, Ionic, and more. Choose your stack, get your code.</p>
                </div>
              </div>
            </div>
            <div className="feature-card-unique p-8">
              <div className="flex items-start gap-6">
                <span className="stat-highlight text-3xl opacity-20">03</span>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Iterate &amp; Refine</h3>
                  <p className="landing-text-muted leading-relaxed">Not perfect on the first try? Use follow-up prompts to refine colors, spacing, components, or functionality.</p>
                </div>
              </div>
            </div>
            <div className="feature-card-unique p-8">
              <div className="flex items-start gap-6">
                <span className="stat-highlight text-3xl opacity-20">04</span>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Text to Code</h3>
                  <p className="landing-text-muted leading-relaxed">Describe any UI you want in plain English.</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

// ─── Social Proof ──────────────────────────────────────────────────────────────
const LOGOS = [
  { src: "https://picoapps.xyz/logos/microsoft.png", alt: "Microsoft" },
  { src: "https://picoapps.xyz/logos/amazon.png",    alt: "Amazon" },
  { src: "https://picoapps.xyz/logos/mit.png",       alt: "MIT" },
  { src: "https://picoapps.xyz/logos/stanford.png",  alt: "Stanford" },
  { src: "https://picoapps.xyz/logos/bytedance.png", alt: "ByteDance" },
  { src: "https://picoapps.xyz/logos/baidu.png",     alt: "Baidu" },
];

function SocialProof() {
  return (
    <section className="py-16 px-6 border-y landing-border overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <p className="text-center landing-text-muted mb-12 max-w-2xl mx-auto">
          #1 tool used by developers and designers from leading companies.<br className="hidden sm:block" />
          {" "}Fully open source with{" "}
          <span className="stat-highlight text-[#2563EB]">71,000+</span> stars on GitHub.
        </p>
        <div className="flex gap-12 sm:gap-16 items-center justify-center flex-wrap">
          {LOGOS.map((l) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={l.alt}
              src={l.src}
              alt={l.alt}
              className="h-8 sm:h-10 w-auto object-contain grayscale opacity-50 hover:opacity-80 transition-opacity logo-dark-invert"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Testimonials ──────────────────────────────────────────────────────────────
const TWEET_IDS = [
  "1733865178905661940", // Rowan Cheung
  "1727105236811366669", // Siqi Chen
  "1732032876739224028", // Natia Kurdadze
  "1728496255473459339", // MakerThrive
];

function Testimonials() {
  return (
    <section className="py-24 px-6 landing-bg overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-sm text-[#2563EB] uppercase tracking-widest mb-4">What people say</p>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Developers <span className="font-editorial">love</span> it
          </h2>
        </div>
        <div
          className="compact-tweets grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start"
          data-theme="dark"
        >
          {TWEET_IDS.map((id) => (
            <div key={id} className="min-w-0">
              <TweetEmbed id={id} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA ───────────────────────────────────────────────────────────────────────
function CTA() {
  return (
    <section className="py-24 px-6 bg-[#0D0D0D] relative overflow-hidden">
      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />

      <div className="relative max-w-4xl mx-auto text-center">
        <h2 className="text-4xl sm:text-6xl font-bold text-white tracking-tight mb-6">
          Ready to ship<br />
          <span className="text-outline text-white">faster?</span>
        </h2>
        <p className="text-xl text-gray-400 mb-10 max-w-xl mx-auto">
          Join 71,000+ developers building UIs at lightning speed
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/app"
            className="bg-white text-[#0D0D0D] px-8 py-4 text-base font-semibold hover:bg-[#2563EB] hover:text-white transition-colors inline-flex items-center justify-center gap-2"
          >
            Start Building
            <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 448 512" className="text-sm" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
              <path d="M190.5 66.9l22.2-22.2c9.4-9.4 24.6-9.4 33.9 0L441 239c9.4 9.4 9.4 24.6 0 33.9L246.6 467.3c-9.4 9.4-24.6 9.4-33.9 0l-22.2-22.2c-9.5-9.5-9.3-25 .4-34.3L311.4 296H24c-13.3 0-24-10.7-24-24v-32c0-13.3 10.7-24 24-24h287.4L190.9 101.2c-9.8-9.3-10-24.8-.4-34.3z" />
            </svg>
          </Link>
          <a
            href="https://github.com/abi/screenshot-to-code"
            target="_blank"
            rel="noopener noreferrer"
            className="border border-white/20 text-white px-8 py-4 text-base font-medium hover:border-white/40 transition-colors inline-flex items-center justify-center gap-2"
          >
            <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 496 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
              <path d="M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3.3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3zm44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9.3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8zM97.2 352.9c-1.3 1-1 3.3.7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3.3 2.9 2.3 3.9 1.6 1 3.6.7 4.3-.7.7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3.7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3.7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9 1.6 2.3 4.3 3.3 5.6 2.3 1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z" />
            </svg>
            Star on GitHub
          </a>
        </div>
      </div>

      {/* Corner decoration */}
      <div className="absolute bottom-0 right-0 w-48 h-48 border-l border-t border-[#2563EB]/20" />
    </section>
  );
}

// ─── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-white/[0.06] landing-bg">
      <div className="max-w-7xl mx-auto px-6 pt-16 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-12 mb-16">
          <div className="max-w-[320px]">
            <div className="flex items-center gap-2 mb-4">
              <Image
                src="/favicon/main.png"
                alt="Logo"
                width={24}
                height={24}
                className="logo-dark-mode"
              />
              <span className="text-white font-semibold text-[15px]">PicToFrontend</span>
            </div>
            <p className="landing-text-muted text-[14px] leading-relaxed">
              AI-powered conversion from screenshots to clean, production-ready code. Open source with 71,000+ GitHub stars.
            </p>
          </div>
          <div>
            <h4 className="landing-text-muted text-[11px] font-semibold tracking-[0.1em] uppercase mb-5">Resources</h4>
            <ul className="space-y-3">
              <li><a href="https://github.com/abi/screenshot-to-code" target="_blank" rel="noopener noreferrer" className="landing-text-muted hover:text-white text-[14px] transition-colors">GitHub</a></li>
              <li><a href="#" className="landing-text-muted hover:text-white text-[14px] transition-colors">Documentation</a></li>
              <li><a href="#" className="landing-text-muted hover:text-white text-[14px] transition-colors">Contact</a></li>
            </ul>
          </div>
          <div>
            <h4 className="landing-text-muted text-[11px] font-semibold tracking-[0.1em] uppercase mb-5">Legal</h4>
            <ul className="space-y-3">
              <li><a href="#" className="landing-text-muted hover:text-white text-[14px] transition-colors">Terms of Service</a></li>
              <li><a href="#" className="landing-text-muted hover:text-white text-[14px] transition-colors">Privacy Policy</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/[0.06] pt-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="landing-text-muted text-[13px]">© 2026 PicToFrontend. All rights reserved.</span>
          <span className="landing-text-muted text-[13px]">Made with ❤️</span>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <VideoToCode />
        <HowItWorks />
        <SocialProof />
        <Testimonials />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
