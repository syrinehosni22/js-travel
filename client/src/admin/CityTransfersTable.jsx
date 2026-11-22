import { RemoveButton } from './shared.jsx';

export const PER_OPTS = [['booking', 'par groupe (réservation)'], ['person', 'par personne'], ['vehicle', 'par véhicule']];

/** Tableau « Ville · Prix du déplacement · Compté » (prix communs ou propres à une excursion) */
export default function CityTransfersTable({ list = [], onChange, addLabel = '+ Ville' }) {
  const edit = (i, patch) => onChange(list.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  return (
    <>
      {list.length > 0 && (
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Ville de l’hôtel</th><th>Prix du déplacement (€)</th><th>Compté</th><th /></tr></thead>
          <tbody>{list.map((c, i) => (
            <tr key={i}>
              <td><input aria-label="Ville" placeholder="Ex. : Nabeul" value={c.city || ''} onChange={(ev) => edit(i, { city: ev.target.value })} /></td>
              <td><input aria-label={`Prix du déplacement depuis ${c.city || 'cette ville'}`} type="number" min="0" step="0.01" value={c.price ?? ''} onChange={(ev) => edit(i, { price: ev.target.value === '' ? null : +ev.target.value })} /></td>
              <td><select aria-label="Compté" value={c.per || 'booking'} onChange={(ev) => edit(i, { per: ev.target.value })}>{PER_OPTS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
              <td><RemoveButton what={`le déplacement depuis ${c.city || 'cette ville'}`} onConfirm={() => onChange(list.filter((_, k) => k !== i))} /></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <div><button type="button" className="link-btn" onClick={() => onChange([...list, { city: '', price: null, per: 'booking' }])}>{addLabel}</button></div>
    </>
  );
}
