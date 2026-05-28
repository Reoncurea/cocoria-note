export function CocoriaLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* 大きい外側の輪 */}
      <circle cx="22" cy="25" r="16" stroke="#C08080" strokeWidth="3.8" strokeLinecap="round" />
      {/* 小さい内側の輪（右下にオフセット） */}
      <circle cx="36" cy="34" r="11.5" stroke="#C08080" strokeWidth="3.8" strokeLinecap="round" />
      {/* 前面に見える部分（大きい輪の一部を上書きして奥行きを表現） */}
      <path
        d="M 36 22.5 A 11.5 11.5 0 0 1 47.5 34"
        stroke="#C08080"
        strokeWidth="4.2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}
