// Ello's official wordmark, exported from Ello's Figma (paths unchanged; Figma ids and
// export-only attributes removed). Server-safe, no client JS. Also used by the OG image
// and app icon routes (ImageResponse renders inline <svg>).

export const WORDMARK_VIEWBOX = "0 0 48.2336 31.2796";
export const WORDMARK_RATIO = 48.2336 / 31.2796; // width / height
export const ELLO_TEAL = "#00C6C3";

export const WORDMARK_PATHS = [
  "M12.417 13.5201L4.09229 14.4965L4.48925 18.6595L11.875 17.7606L12.2478 20.824L4.78226 21.7326L5.32375 27.4113L15.1151 26.3328L15.453 29.4002L2.54906 30.8216L1.71791 22.1056L0.372849 22.2693L0 19.2059L1.4249 19.0325L0.733681 11.7834L12.0575 10.4551L12.417 13.5201Z",
  "M21.0889 30.2269L18.0339 30.6623L14.5378 6.13102L17.5929 5.69561L21.0889 30.2269Z",
  "M26.7461 31.0939L23.6658 31.2796L21.7908 0.18589L24.8711 0.000114441L26.7461 31.0939Z",
  "M37.8968 15.3102C38.2009 15.3102 38.5146 15.3243 38.8302 15.3517C40.9471 15.5369 42.6529 16.2684 43.764 17.4693C44.7981 18.5873 45.2639 20.097 45.1119 21.8344C44.9705 23.4526 44.3305 24.7921 43.2619 25.7088C42.1456 26.6662 40.5794 27.1718 38.7321 27.1718C38.428 27.1718 38.1142 27.1577 37.7987 27.1303C35.6818 26.945 33.9759 26.2135 32.8658 25.0126C31.8317 23.8947 31.3659 22.385 31.5179 20.6476C31.6593 19.0293 32.2992 17.6899 33.3678 16.7731C34.4842 15.8158 36.0504 15.3102 37.8977 15.3102M37.8968 12.2219C32.621 12.2219 28.8724 15.3922 28.4349 20.3785C27.9656 25.7353 31.6257 29.6918 37.5282 30.2071C37.9375 30.2424 38.3388 30.2601 38.7312 30.2601C44.007 30.2601 47.7556 27.0897 48.1931 22.1035C48.6624 16.7467 45.0023 12.7902 39.0998 12.2749C38.6905 12.2396 38.2893 12.2219 37.8968 12.2219Z",
  "M35.0785 20.0737C34.9636 21.3867 35.3287 22.3096 35.9863 22.367C36.6439 22.4243 37.1645 21.5781 37.2794 20.2652C37.3943 18.9522 37.0292 18.0293 36.3716 17.9719C35.714 17.9146 35.1934 18.7607 35.0785 20.0737Z",
  "M39.5027 20.4598C39.3878 21.7728 39.7528 22.6957 40.4104 22.7531C41.068 22.8104 41.5886 21.9643 41.7036 20.6513C41.8185 19.3383 41.4534 18.4154 40.7958 18.358C40.1382 18.3007 39.6176 19.1469 39.5027 20.4598Z",
];

/**
 * The "Ello" wordmark, sized by height (width follows the aspect ratio).
 * `color` defaults to Ello teal; pass "currentColor" to inherit, or "#fff" on teal.
 * Has the accessible name "Ello" unless `decorative` (e.g. right next to visible "Ello" text).
 */
export function ElloWordmark({
  height = 24,
  color = ELLO_TEAL,
  className,
  decorative = false,
}: {
  height?: number;
  color?: string;
  className?: string;
  decorative?: boolean;
}) {
  return (
    <svg
      width={Math.round(height * WORDMARK_RATIO * 100) / 100}
      height={height}
      viewBox={WORDMARK_VIEWBOX}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
    >
      {!decorative && <title>Ello</title>}
      {WORDMARK_PATHS.map((d, i) => (
        <path key={i} d={d} fill={color} />
      ))}
    </svg>
  );
}

export default ElloWordmark;
