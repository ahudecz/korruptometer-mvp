-- 2026-07-31 nagyköveti visszahívási hullám (25 fő) — a meglévő
-- lemondás/kirúgás/felmentés/egyéb/Hivatalban van típusok egyike sem
-- illik rá pontosan: ezek rutin diplomáciai posztváltások ("érdemei
-- elismerésével"), nem fegyelmi felmentés vagy lemondás. Additív, nem
-- destruktív bővítés (Principle VII — nem drop/rename, nincs szükség
-- két lépéses migrációra).
ALTER TYPE resignation_type ADD VALUE IF NOT EXISTS 'visszahívás';
