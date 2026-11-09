import { useTranslation } from 'react-i18next';
import { useApp } from '../context.jsx';
import { LANGS, path } from '../i18n.js';
import { Seo } from '../components/ui.jsx';

export default function Faq() {
  const { t } = useTranslation();
  const { settings } = useApp();
  const faq = settings?.faq || [];
  return (
    <>
      <Seo title={t('home.faqTitle')} alternates={Object.fromEntries(LANGS.map((l) => [l, path(l, 'faq')]))}
        jsonLd={faq.length ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) } : undefined} />
      <div className="page-head"><div className="container"><h1>{t('home.faqTitle')}</h1></div></div>
      <div className="container section"><div className="faq">{faq.map((f, i) => <details key={i}><summary>{f.q}</summary><p>{f.a}</p></details>)}</div></div>
    </>
  );
}
