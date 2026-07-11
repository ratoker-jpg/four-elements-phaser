from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'src/state/buildSiteSelection.ts'
text = path.read_text(encoding='utf-8')

old_building_footprint = """  for (const b of state.mapData.buildings) {
    if ((b.ownerTeamId ?? ownerTeamId) !== ownerTeamId) continue;
    const config = BUILDING_CONFIG[b.type];"""
new_building_footprint = """  for (const b of state.mapData.buildings) {
    const config = BUILDING_CONFIG[b.type];"""
if old_building_footprint not in text:
    raise RuntimeError('building footprint marker not found')
text = text.replace(old_building_footprint, new_building_footprint, 1)

old_site_footprint = """  for (const c of state.mapData.constructionSites) {
    if ((c.ownerTeamId ?? ownerTeamId) !== ownerTeamId) continue;
    const config = BUILDING_CONFIG[c.type];"""
new_site_footprint = """  for (const c of state.mapData.constructionSites) {
    const config = BUILDING_CONFIG[c.type];"""
if old_site_footprint not in text:
    raise RuntimeError('site footprint marker not found')
text = text.replace(old_site_footprint, new_site_footprint, 1)

old_building_anchors = """  // Completed building centers
  for (const b of state.mapData.buildings) {
    const config = BUILDING_CONFIG[b.type];"""
new_building_anchors = """  // Completed building centers
  for (const b of state.mapData.buildings) {
    if ((b.ownerTeamId ?? ownerTeamId) !== ownerTeamId) continue;
    const config = BUILDING_CONFIG[b.type];"""
if old_building_anchors not in text:
    raise RuntimeError('building anchor marker not found')
text = text.replace(old_building_anchors, new_building_anchors, 1)

old_site_anchors = """  // Construction site centers
  for (const c of state.mapData.constructionSites) {
    const config = BUILDING_CONFIG[c.type];"""
new_site_anchors = """  // Construction site centers
  for (const c of state.mapData.constructionSites) {
    if ((c.ownerTeamId ?? ownerTeamId) !== ownerTeamId) continue;
    const config = BUILDING_CONFIG[c.type];"""
if old_site_anchors not in text:
    raise RuntimeError('site anchor marker not found')
text = text.replace(old_site_anchors, new_site_anchors, 1)

path.write_text(text, encoding='utf-8')
print('SKIRMISH-P4B fix1 applied')
