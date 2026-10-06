import Image from "next/image";

type AvatarProps = {
  name: string | null | undefined;
  image: string | null | undefined;
  // CSS 像素
  size?: number;
};

// 使用者頭像：有圖片就顯示，沒有就用名稱首字（取第一個 Unicode 字元，中文名也正確）。
export function Avatar({ name, image, size = 64 }: AvatarProps) {
  const label = name?.trim() || "使用者";

  if (image) {
    return (
      <Image
        src={image}
        alt={label}
        width={size}
        height={size}
        className="rounded-full object-cover"
        // Google 頭像網址在帶 Referer 時偶爾會回 403
        referrerPolicy="no-referrer"
      />
    );
  }

  const initial = Array.from(label)[0] ?? "?";
  return (
    <div
      role="img"
      aria-label={label}
      className="flex items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initial}
    </div>
  );
}
