/** Néhány csatorna csupa nagybetűs kulcsszó-felsorolással kezdi a leírást
 *  ("TISZA PÁRT, MAGYAR PÉTER, ..."), ami mondat helyett tag-halmoznak
 *  néz ki kiírva — ezt is kihagyjuk, nem csak a túl rövid bekezdéseket. */
function looksLikeTagSalad(s: string): boolean {
  return !/[a-zíáéóúőűöü]/.test(s);
}

/** A nyers YouTube-leírás gyakran linkekkel/hashtag-halmokkal/csupa-nagybetűs
 *  kulcsszó-sorral kezdődik — ezeken végigmegyünk, amíg egy valódi,
 *  elég hosszú mondatra nem bukkanunk. Ha semmi nem marad (l. a kézzel
 *  kitűzött sorok, ahol description=''), inkább nem mutatunk semmit, mint
 *  egy törött-tűnő fél mondatot vagy egy kulcsszó-listát. Megosztva a
 *  homepage és a /podcastok végoldal spotlight-jai között. */
export function cleanSpotlightDescription(raw: string): string | null {
  const withoutUrls = raw.replace(/https?:\/\/\S+/g, '').trim();
  const blocks = withoutUrls.split(/\n{2,}|\n(?=#)/).map((b) => b.trim()).filter(Boolean);
  for (const block of blocks) {
    const withoutHashtags = block.replace(/#\S+/g, '').trim();
    if (withoutHashtags.length < 30) continue;
    if (looksLikeTagSalad(withoutHashtags)) continue;
    return withoutHashtags.length > 220 ? `${withoutHashtags.slice(0, 217).trim()}…` : withoutHashtags;
  }
  return null;
}
