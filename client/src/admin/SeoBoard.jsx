import { Link } from 'react-router-dom';
import { adminApi } from '../api.js';
import { useLoad, Top, Err, LANGS } from './shared.jsx';
import SeoSummary from './SeoSummary.jsx';

/**
 * Tableau SEO : score et champs manquants de chaque fiche par langue (§8.2).
 * Les clics et la position moyenne nécessitent de connecter Google Search Console
 * (API searchanalytics.query) — à brancher dans routes/admin.js avec un compte de service.
 */
export default function SeoBoard() {
  const { data, error } = useLoad(() => adminApi.get('/seo'));
  return (
    <>
      <Top title="SEO" />
      <SeoSummary />
      <h2 style={{ fontSize: 18, margin: '20px 0 10px' }}>Score par fiche et par langue</h2>
      <Err error={error} />
      <div className="panel tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Fiche</th>{LANGS.map((l) => <th key={l}>{l.toUpperCase()}</th>)}</tr></thead>
          <tbody>{(data || []).map((row) => (
            <tr key={row.id}>
              <td><Link to={`/admin/excursions/${row.id}`}>{row.title}</Link></td>
              {LANGS.map((l) => {
                const r = row.report[l];
                return <td key={l} title={r.missing.length ? `Manquant : ${r.missing.join(', ')}` : 'Complet'}><span className={`light light-${r.light}`} /> {r.score}{r.missing.length > 0 && <small style={{ color: '#9B1C1C' }}> · {r.missing.length} manquant(s)</small>}</td>;
              })}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}
