'use client';

export function NewsCardImage({ src }: { src: string }) {
  const proxied = `/api/img-proxy?url=${encodeURIComponent(src)}`;
  return (
    <div className="news-card-img">
      <img
        src={proxied}
        alt=""
        loading="lazy"
        onError={(e) => {
          const wrapper = e.currentTarget.parentElement;
          if (wrapper) wrapper.style.display = 'none';
        }}
      />
    </div>
  );
}
