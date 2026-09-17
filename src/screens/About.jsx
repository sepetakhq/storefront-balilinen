import { Img, SIZES } from '../ui/Img.jsx';
import { WhatsAppIcon } from '../components/icons.jsx';
import { useConfig } from '@sepetakhq/storefront-kit/config/ConfigProvider';
import { paragraphs } from '@sepetakhq/storefront-kit/shared/format';

export default function About() {
  const { brand, tenant } = useConfig();
  const portrait = brand.aboutImage;
  const title = brand.aboutTitle || [brand.wordmark_primary, brand.wordmark_accent].filter(Boolean).join(' ');
  const story = paragraphs(brand.aboutBody);

  return (
    <main
      aria-label={`About ${title}`}
      className="bl-wrap"
      style={{
        flex: 1,
        maxWidth: 1100,
        padding: '56px 32px 20px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 56,
        alignItems: 'start',
      }}
    >
      <Img src={portrait?.url} srcSet={portrait?.srcset} sizes={SIZES.hero} alt={portrait?.alt || ''} ratio="1/1" radius={20} className="bl-sticky" />
      <div>
        <div className="bl-eyebrow plain">{brand.sections.story_eyebrow}</div>
        <h1 className="bl-display" style={{ fontSize: 40, margin: '14px 0 0' }}>
          {title}
        </h1>
        <div style={{ marginTop: 18 }}>
          {story.map((pg, i) => (
            <p key={i} className="bl-muted" style={{ fontSize: 15.5, lineHeight: 1.75, margin: '0 0 14px', textWrap: 'pretty' }}>
              {pg}
            </p>
          ))}
        </div>
        <div style={{ marginTop: 28, fontSize: 14, lineHeight: 1.7 }}>
          <b>{tenant.name}</b>
          {brand.address_line1 ? (
            <>
              <br />
              {brand.address_line1}
            </>
          ) : null}
          {brand.address_line2 ? (
            <>
              <br />
              {brand.address_line2}
            </>
          ) : null}
          {brand.email ? (
            <>
              <br />
              <a href={`mailto:${brand.email}`}>{brand.email}</a>
            </>
          ) : null}
        </div>
        {brand.whatsapp_url ? (
          <a href={brand.whatsapp_url} target="_blank" rel="noopener noreferrer" className="bl-btn wa" style={{ marginTop: 26 }}>
            <WhatsAppIcon />
            {brand.whatsapp_text || 'Chat on WhatsApp'}
          </a>
        ) : null}
      </div>
    </main>
  );
}
