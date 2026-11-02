import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Clock,
  Color,
  IcosahedronGeometry,
  Mesh,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from 'three'

// Noise-displaced blob + orbiting particles. `progress` (0..1) is driven by scroll from motion.ts.
export interface HeroScene {
  setProgress(p: number): void
  dispose(): void
}

const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`

export function createHeroScene(canvas: HTMLCanvasElement, opts: { static?: boolean } = {}): HeroScene | null {
  let renderer: WebGLRenderer
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  } catch {
    return null // no WebGL: the CSS poster stays
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))

  const scene = new Scene()
  const camera = new PerspectiveCamera(40, 1, 0.1, 100)
  camera.position.set(0, 0, 6)

  const uniforms = {
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uColorA: { value: new Color('#7c5cff') },
    uColorB: { value: new Color('#21d4fd') },
    uColorC: { value: new Color('#ff5ca8') },
  }

  const blob = new Mesh(
    new IcosahedronGeometry(1.45, 64),
    new ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */ `
        ${NOISE}
        uniform float uTime; uniform float uProgress;
        varying float vNoise; varying vec3 vNormal; varying vec3 vView;
        void main(){
          float amp = mix(.32, .7, uProgress);
          float n = snoise(normal * 1.4 + uTime * .25) * amp;
          vNoise = n;
          vec3 pos = position + normal * n;
          vec4 mv = modelViewMatrix * vec4(pos, 1.);
          vNormal = normalize(normalMatrix * normal);
          vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColorA; uniform vec3 uColorB; uniform vec3 uColorC; uniform float uProgress;
        varying float vNoise; varying vec3 vNormal; varying vec3 vView;
        void main(){
          float fres = pow(1. - max(dot(vNormal, vView), 0.), 2.2);
          vec3 base = mix(uColorA, uColorB, smoothstep(-.3, .4, vNoise));
          base = mix(base, uColorC, uProgress * .6 * fres);
          vec3 col = base * (.35 + .65 * fres) + fres * .35;
          gl_FragColor = vec4(col, 1.);
        }`,
    }),
  )
  scene.add(blob)

  // Particle halo
  const COUNT = 1400
  const positions = new Float32Array(COUNT * 3)
  for (let i = 0; i < COUNT; i++) {
    const r = 2.2 + Math.random() * 2.4
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.6
    positions[i * 3 + 2] = r * Math.cos(phi)
  }
  const pGeo = new BufferGeometry()
  pGeo.setAttribute('position', new BufferAttribute(positions, 3))
  const particles = new Points(
    pGeo,
    new ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uTime;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.);
          gl_PointSize = (2.2 + sin(uTime + position.x * 3.) * .8) * (6. / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColorB;
        void main(){
          float d = length(gl_PointCoord - .5);
          gl_FragColor = vec4(uColorB, smoothstep(.5, 0., d) * .7);
        }`,
    }),
  )
  scene.add(particles)

  const pointer = { x: 0, y: 0 }
  const onPointer = (e: PointerEvent) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1
  }
  window.addEventListener('pointermove', onPointer, { passive: true })

  // Wide screens: blob sits to the right of the copy. Narrow: centered and further back.
  let offsetX = 0
  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.position.z = w < 640 ? 8.5 : 6.5
    offsetX = w >= 900 ? Math.min(2.4, camera.aspect * 1.1) : 0
    camera.updateProjectionMatrix()
  }
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)
  resize()

  const clock = new Clock()
  let visible = true
  let raf = 0
  const render = () => {
    const t = clock.getElapsedTime()
    uniforms.uTime.value = t
    const p = uniforms.uProgress.value
    blob.rotation.y += (pointer.x * 0.6 + t * 0.15 - blob.rotation.y) * 0.04
    blob.rotation.x += (pointer.y * 0.4 - blob.rotation.x) * 0.04
    blob.scale.setScalar(1 - p * 0.25)
    blob.position.set(offsetX * (1 - p * 0.6), offsetX ? p * 0.6 : 0.9 + p * 0.6, 0)
    particles.position.x = blob.position.x
    particles.rotation.y = t * 0.04 + p * 1.2
    renderer.render(scene, camera)
  }
  const loop = () => {
    if (visible) render()
    raf = requestAnimationFrame(loop)
  }

  const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting))
  io.observe(canvas)

  if (opts.static) render()
  else loop()

  return {
    setProgress(p) {
      uniforms.uProgress.value = p
      if (opts.static) render()
    },
    dispose() {
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      window.removeEventListener('pointermove', onPointer)
      renderer.dispose()
    },
  }
}
