export function CocoriaLogo({ size = 40 }: { size?: number }) {
  return (
    <img src="/logo.png" width={size} height={size} alt="cocorianote logo" style={{ objectFit: 'contain' }} />
  )
}
