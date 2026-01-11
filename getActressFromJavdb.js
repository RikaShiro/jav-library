const axios = require('axios')
const cheerio = require('cheerio')

// Base URL for JavDB. Prefer environment variable so it can be rotated without code changes.
const DEFAULT_JAVDB_BASE = 'https://javdb565.com'
const JAVDB_BASE =
	process.env.JAVDB_BASE || process.env.JAVDB_HOST || DEFAULT_JAVDB_BASE

/**
 * Search javdb368.com for the given AV number and return an array of actress names.
 * @param {string} avNumber - e.g. 'SNIS-999'
 * @returns {Promise<string[]>} - array of actress names (may be empty)
 */
module.exports = async function getActressFromJavdb(avNumber) {
	if (!avNumber || typeof avNumber !== 'string')
		throw new Error('avNumber must be a non-empty string')
	const searchUrl = `${JAVDB_BASE}/search?q=${encodeURIComponent(avNumber)}`
	const headers = {
		'User-Agent': 'Mozilla/5.0 (compatible; ActressFinder/1.0)',
	}

	const res = await axios.get(searchUrl, { headers })
	let $ = cheerio.load(res.data)

	// If search returned the movie page directly, parse it
	if ($('nav.panel.movie-panel-info').length) {
		return parseActorsFromDocument($)
	}

	const avLower = avNumber.toLowerCase()
	const ids = $('div.video-title > strong')
		.map((i, el) => $(el).text().trim().toLowerCase())
		.get()
	const links = $('a.box')
		.map((i, el) => $(el).attr('href'))
		.get()
	const titles = $('a.box')
		.map((i, el) => $(el).attr('title'))
		.get()

	let idx = ids.findIndex((id) => id === avLower)
	if (idx === -1)
		idx = titles.findIndex((t) => t && t.toLowerCase().includes(avLower))
	if (idx === -1) idx = ids.findIndex((id) => id.includes(avLower))

	if (idx === -1)
		throw new Error(`Movie ${avNumber} not found on search results`)

	let movieUrl = links[idx]
	if (!movieUrl.startsWith('http')) movieUrl = JAVDB_BASE + movieUrl

	const res2 = await axios.get(movieUrl, { headers })
	const $2 = cheerio.load(res2.data)
	return parseActorsFromDocument($2)
}

function parseActorsFromDocument($doc) {
	const info = $doc('nav.panel.movie-panel-info').first()
	if (!info || !info.length)
		throw new Error('Actors section not found on movie page')

	let actorsSpan
	info.find('strong').each((i, el) => {
		const txt = $doc(el).text().trim()
		if (txt === '演員:' || txt === '演員') {
			actorsSpan = $doc(el).parent().find('span').first()
			return false
		}
	})

	if (!actorsSpan || !actorsSpan.length) {
		const candidate = info
			.find('span')
			.filter((i, el) => $doc(el).find('a').length > 0)
			.first()
		actorsSpan = candidate.length ? candidate : actorsSpan
	}

	if (!actorsSpan || !actorsSpan.length)
		throw new Error('Actors section not found on movie page')

	const allActors = actorsSpan
		.find('a')
		.map((i, el) => $doc(el).text().trim())
		.get()
	const genders = actorsSpan
		.find('a')
		.map((i, el) => {
			const g = $doc(el).next('strong').text().trim()
			return g || ''
		})
		.get()

	const actresses = allActors.filter((name, i) => {
		const g = genders[i] || ''
		return g.includes('♀') || g.includes('女') || g === '♀'
	})

	return actresses
}
