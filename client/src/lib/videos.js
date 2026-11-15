/** Liste des vidéos d'une excursion : `videos` (fichiers envoyés) + ancien champ `video`, sans doublon */
export function allVideos(e) {
  return [...new Set([...(e?.videos || []), e?.video].filter(Boolean))];
}

/** Le fichier choisi est-il une vidéo ? */
export const isVideoFile = (f) => /^video\//.test(f.type) || /\.(mp4|webm|mov|m4v)$/i.test(f.name);
