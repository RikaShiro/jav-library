const { exec } = require('child_process')
const path = require('path')
const fs = require('fs').promises
const fsSync = require('fs')
const getActressFromJavdb = require('./getActressFromJavdb')

// run PowerShell FolderBrowserDialog and return selected path or null
function pickFolderWindows() {
	const ps = `Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description='Select folder containing MP4 files'; if($f.ShowDialog() -eq 'OK'){ Write-Output $f.SelectedPath }`
	return new Promise((resolve, reject) => {
		exec(
			`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`,
			{ windowsHide: true },
			(err, stdout, stderr) => {
				if (err) return resolve(null)
				const out = (stdout || '').trim()
				resolve(out || null)
			}
		)
	})
}

function extractAvNumber(filename) {
	// Match patterns like ABP-123, IPX123, SSNI-### etc. Take first match.
	const m = filename.match(/([A-Za-z]{2,5}-?\d{2,5})/i)
	return m ? m[1].toUpperCase() : null
}

async function loadResults(jsonPath) {
	// kept for compatibility
	return {}
}

// saveResults removed - results are persisted inside list.json

async function loadDb(jsonPath) {
	try {
		const txt = await fs.readFile(jsonPath, 'utf8')
		return JSON.parse(txt)
	} catch (e) {
		return { db: {}, results: {} }
	}
}

async function saveDb(jsonPath, obj) {
	const txt = JSON.stringify(obj, null, 2)
	await fs.writeFile(jsonPath, txt, 'utf8')
}

async function main() {
	const folder = await pickFolderWindows()
	if (!folder) {
		console.error('No folder selected. Exiting.')
		process.exit(2)
	}

	// single persistent JSON in the project folder (acts as local DB and results)
	const dbPath = path.join(__dirname, 'list.json')
	const db = await loadDb(dbPath)
	const results = db.results || (db.results = {})
	db.db = db.db || {}

	const entries = await fs.readdir(folder, { withFileTypes: true })
	const mp4s = entries
		.filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.mp4'))
		.map((e) => e.name)

	for (const file of mp4s) {
		const av = extractAvNumber(file)
		if (!av) {
			// record under Unknown
			results['Unknown'] = results['Unknown'] || []
			if (!results['Unknown'].includes(file)) results['Unknown'].push(file)
			continue
		}

		let actresses = []

		if (db.db[av]) {
			actresses = db.db[av]
		} else {
			try {
				actresses = await getActressFromJavdb(av)
			} catch (e) {
				console.error(`Lookup failed for ${av}: ${e.message}`)
				results['LookupError'] = results['LookupError'] || []
				if (!results['LookupError'].includes(av))
					results['LookupError'].push(av)
				// persist lookup error
				try {
					await saveDb(dbPath, db)
				} catch (_) {}
				continue
			}
			// store into local DB (append semantics)
			db.db[av] = actresses
			try {
				await saveDb(dbPath, db)
			} catch (e) {
				console.error(`Failed to update local DB ${dbPath}: ${e.message}`)
			}
		}

		if (!actresses || actresses.length === 0) {
			results['Unknown'] = results['Unknown'] || []
			if (!results['Unknown'].includes(av)) results['Unknown'].push(av)
			// ensure DB has empty array
			db.db[av] = actresses || []
			try {
				await saveDb(dbPath, db)
			} catch (_) {}
			continue
		}

		if (actresses.length > 1) {
			// Do not move; record av under all actresses
			for (const name of actresses) {
				results[name] = results[name] || []
				if (!results[name].includes(av)) results[name].push(av)
			}
			// update DB and continue
			db.db[av] = actresses
			try {
				await saveDb(dbPath, db)
			} catch (_) {}
			continue
		}

		const actress = actresses[0]
		results[actress] = results[actress] || []
		if (!results[actress].includes(av)) results[actress].push(av)

		// Ensure folder exists (match subfolder name exactly)
		const destDir = path.join(folder, actress)
		try {
			if (!fsSync.existsSync(destDir)) await fs.mkdir(destDir)
			const src = path.join(folder, file)
			const dest = path.join(destDir, file)
			await fs.rename(src, dest)
		} catch (e) {
			console.error(`Failed to move ${file} -> ${actress}: ${e.message}`)
		}
		// persist DB after move/update
		db.db[av] = actresses
		try {
			await saveDb(dbPath, db)
		} catch (e) {
			console.error(e.message)
		}
	}

	console.log(`Done. Results and DB saved to ${dbPath}`)
}

main()
