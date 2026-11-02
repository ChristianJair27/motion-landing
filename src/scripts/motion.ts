import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import tokens from '../design/tokens.json'
import type { HeroScene } from './hero3d'

gsap.registerPlugin(ScrollTrigger, SplitText)

const { duration: D, ease: E, stagger: S } = tokens.motion

export function initMotion(getScene: () => HeroScene | null) {
  const mm = gsap.matchMedia()

  mm.add(
    {
      motion: '(prefers-reduced-motion: no-preference)',
      reduce: '(prefers-reduced-motion: reduce)',
      desktop: '(min-width: 900px)',
    },
    (ctx) => {
      const { motion, reduce, desktop } = ctx.conditions as Record<string, boolean>

      // Scroll → 3D progress (works in both modes; the scene renders statically when reduced)
      ScrollTrigger.create({
        trigger: '#hero',
        start: 'top top',
        end: 'bottom top',
        scrub: reduce ? false : 0.6,
        onUpdate: (self) => getScene()?.setProgress(self.progress),
      })

      if (reduce) return

      // 1. Hero intro: nav → headline chars → copy words → CTA
      const title = SplitText.create('[data-split="hero"]', { type: 'chars,words', mask: 'chars' })
      const copy = SplitText.create('[data-split="copy"]', { type: 'words', mask: 'words' })
      gsap
        .timeline({ defaults: { ease: E.out } })
        .from('[data-nav]', { y: -20, autoAlpha: 0, duration: D.base })
        .from(title.chars, { yPercent: 110, duration: D.slow, stagger: S.chars }, '-=0.3')
        .from(copy.words, { yPercent: 100, duration: D.base, stagger: S.words }, '-=0.7')
        .from('[data-cta]', { scale: 0.8, autoAlpha: 0, duration: D.base, ease: E.spring, stagger: S.items }, '-=0.4')
        .from('[data-scroll-hint]', { autoAlpha: 0, y: 10, duration: D.base }, '-=0.2')

      // Hero copy drifts up and fades as the blob takes over
      gsap.to('[data-hero-copy]', {
        yPercent: -30,
        autoAlpha: 0,
        ease: 'none',
        scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom 30%', scrub: true },
      })

      // 2. Infinite stack marquee
      gsap.to('[data-marquee-track]', { xPercent: -50, duration: 28, ease: 'none', repeat: -1 })

      // 3. Features: pinned horizontal scroll on desktop, staggered reveal on mobile
      const track = document.querySelector<HTMLElement>('[data-features-track]')
      if (track && desktop) {
        gsap.to(track, {
          x: () => -(track.scrollWidth - window.innerWidth + 64),
          ease: 'none',
          scrollTrigger: {
            trigger: '#features',
            start: 'top top',
            end: () => `+=${track.scrollWidth}`,
            pin: true,
            scrub: 0.8,
            invalidateOnRefresh: true,
          },
        })
      } else {
        gsap.utils.toArray<HTMLElement>('[data-feature]').forEach((el) =>
          gsap.from(el, {
            y: 60,
            autoAlpha: 0,
            duration: D.base,
            ease: E.out,
            scrollTrigger: { trigger: el, start: 'top 85%' },
          }),
        )
      }

      // 4. Process: line draws with scroll, steps pop in as the line reaches them
      const path = document.querySelector<SVGPathElement>('[data-process-path]')
      if (path) {
        const len = path.getTotalLength()
        gsap.set(path, { strokeDasharray: len, strokeDashoffset: len })
        gsap.to(path, {
          strokeDashoffset: 0,
          ease: 'none',
          scrollTrigger: { trigger: '#process', start: 'top 70%', end: 'bottom 70%', scrub: true },
        })
      }
      gsap.utils.toArray<HTMLElement>('[data-step]').forEach((el) =>
        gsap.from(el, {
          x: -40,
          autoAlpha: 0,
          duration: D.base,
          ease: E.out,
          scrollTrigger: { trigger: el, start: 'top 75%' },
        }),
      )

      // 5. Statement: words light up in reading order
      const statement = SplitText.create('[data-split="statement"]', { type: 'words' })
      gsap.fromTo(
        statement.words,
        { opacity: 0.15 },
        {
          opacity: 1,
          stagger: S.words,
          ease: 'none',
          scrollTrigger: { trigger: '#statement', start: 'top 75%', end: 'bottom 55%', scrub: true },
        },
      )

      // 6. Magnetic CTA buttons (pointer devices only)
      if (motion && window.matchMedia('(pointer: fine)').matches) {
        document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((btn) => {
          const xTo = gsap.quickTo(btn, 'x', { duration: D.base, ease: E.out })
          const yTo = gsap.quickTo(btn, 'y', { duration: D.base, ease: E.out })
          btn.addEventListener('pointermove', (e) => {
            const r = btn.getBoundingClientRect()
            xTo((e.clientX - r.left - r.width / 2) * 0.3)
            yTo((e.clientY - r.top - r.height / 2) * 0.3)
          })
          btn.addEventListener('pointerleave', () => {
            xTo(0)
            yTo(0)
          })
        })
      }

      return () => {
        title.revert()
        copy.revert()
        statement.revert()
      }
    },
  )
}
