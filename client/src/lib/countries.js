/** Codes pays ISO 3166-1 alpha-2 ; les noms sont traduits par le navigateur (Intl.DisplayNames). */
const CODES = 'AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD CL CN CO KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HK HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG MK NO OM PK PW PS PA PG PY PE PH PL PT PR QA RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA KR SS ES LK SD SR SE CH SY TW TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VA VE VN YE ZM ZW'.split(' ');

/** Liste triée [{ code, name }] dans la langue du site ; quelques pays fréquents en tête. */
export function countryList(lang) {
  let dn = null;
  try { dn = new Intl.DisplayNames([lang], { type: 'region' }); } catch { /* navigateur ancien */ }
  const name = (c) => (dn ? dn.of(c) : c) || c;
  const all = CODES.map((code) => ({ code, name: name(code) })).sort((a, b) => a.name.localeCompare(b.name, lang));
  const top = ['TN', 'FR', 'DE', 'GB', 'IT', 'ES', 'BE', 'CH', 'DZ', 'LY'].map((code) => ({ code, name: name(code) }));
  return { top, all };
}

export const countryName = (code, lang = 'fr') => {
  if (!code) return '';
  try { return new Intl.DisplayNames([lang], { type: 'region' }).of(code) || code; } catch { return code; }
};
