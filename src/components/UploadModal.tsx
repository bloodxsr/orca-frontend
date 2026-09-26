import { useState, useRef, useCallback, useEffect } from 'react'
import Map, { Source, Layer } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'

interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
  onUploadComplete: (jobId: string, investigationId: string) => void
}

export default function UploadModal({ isOpen, onClose, onUploadComplete }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [observedAt, setObservedAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [bbox, setBbox] = useState(['80.1', '15.2', '81.4', '16.3'])
  const [mapClicks, setMapClicks] = useState<[number, number][]>([])
  const [weather, setWeather] = useState({ windSpeed: '', windDirection: '', currentSpeed: '', currentDirection: '' })
  const [title, setTitle] = useState('')
  const [aisSource, setAisSource] = useState<'upload' | 'live'>('upload')
  const [aisFile, setAisFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const aisInputRef = useRef<HTMLInputElement>(null)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0])
      setError('')
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setError('')
    }
  }

  const handleMapClick = (e: any) => {
    const { lng, lat } = e.lngLat
    let newClicks = [...mapClicks, [lng, lat]] as [number, number][]
    if (newClicks.length > 2) {
      newClicks = [[lng, lat]]
    }
    setMapClicks(newClicks)
    
    if (newClicks.length === 2) {
      const minLon = Math.min(newClicks[0][0], newClicks[1][0])
      const maxLon = Math.max(newClicks[0][0], newClicks[1][0])
      const minLat = Math.min(newClicks[0][1], newClicks[1][1])
      const maxLat = Math.max(newClicks[0][1], newClicks[1][1])
      setBbox([minLon.toFixed(4), minLat.toFixed(4), maxLon.toFixed(4), maxLat.toFixed(4)])
    }
  }

  const getBboxGeoJSON = (): any => {
    if (mapClicks.length === 1) {
      return {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: mapClicks[0] }, properties: {} }]
      }
    }
    
    const [minLon, minLat, maxLon, maxLat] = bbox.map(Number)
    if (isNaN(minLon) || isNaN(minLat) || isNaN(maxLon) || isNaN(maxLat) || bbox.every(v => v === '')) return null

    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[[minLon, minLat], [maxLon, minLat], [maxLon, maxLat], [minLon, maxLat], [minLon, minLat]]]
        },
        properties: {}
      }]
    }
  }

  const handleFileSelectOld = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setError('')
    }
  }

  const toVector = (speed: number, direction: number) => {
    const radians = direction * Math.PI / 180
    return { u: speed * Math.sin(radians), v: speed * Math.cos(radians) }
  }

  const parseAisCsv = async (source: File) => {
    const [header, ...rows] = (await source.text()).trim().split(/\r?\n/)
    const fields = header.split(',').map((field) => field.trim())
    const required = ['mmsi', 'timestamp', 'latitude', 'longitude', 'speed_knots', 'course_deg']
    if (required.some((field) => !fields.includes(field))) throw new Error(`AIS CSV needs: ${required.join(', ')}`)
    return rows.filter(Boolean).map((row) => {
      const values = row.split(',').map((value) => value.trim())
      const record = Object.fromEntries(fields.map((field, index) => [field, values[index] || undefined])) as Record<string, string | undefined>
      return { ...record, latitude: Number(record.latitude), longitude: Number(record.longitude), speed_knots: Number(record.speed_knots), course_deg: Number(record.course_deg), heading_deg: record.heading_deg ? Number(record.heading_deg) : null }
    })
  }

  const handleUploadAndDetect = async () => {
    if (!file) return
    const coordinates = bbox.map(Number)
    const measurements = Object.fromEntries(Object.entries(weather).map(([key, value]) => [key, Number(value)])) as Record<string, number>
    if (!observedAt || coordinates.some((value) => !Number.isFinite(value)) || coordinates[0] >= coordinates[2] || coordinates[1] >= coordinates[3]) {
      setError('Enter a valid observation time and bounding box: west, south, east, north.')
      return
    }
    if (Object.values(measurements).some((value) => !Number.isFinite(value)) || measurements.windSpeed < 0 || measurements.currentSpeed < 0 || measurements.windDirection < 0 || measurements.windDirection > 360 || measurements.currentDirection < 0 || measurements.currentDirection > 360) { setError('Enter wind/current speeds and directions (directions are 0–360°).'); return }
    setUploading(true)
    setError('')

    try {
      let aisPositions: any[] = []
      if (aisSource === 'upload' && aisFile) {
        aisPositions = await parseAisCsv(aisFile)
      } else if (aisSource === 'live') {
        setProgress('Fetching Live AIS Data...')
        const fetchResp = await fetch('/api/v1/telemetry/fetch-live', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}) },
          body: JSON.stringify({ bbox: coordinates, observed_at: observedAt, hours_back: 48 })
        });
        if (!fetchResp.ok) throw new Error('Live AIS Fetch failed. The endpoint might be a mock or unavailable.')
        aisPositions = await fetchResp.json()
      }
      // Step 1: Upload the satellite image
      setProgress('Uploading satellite imagery...')
      const formData = new FormData()
      formData.append('file', file)

      const token = localStorage.getItem('token')

      const uploadResp = await fetch('/api/v1/upload/satellite', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })

      if (!uploadResp.ok) {
        const err = await uploadResp.json()
        throw new Error(err.error || 'Upload failed')
      }

      const uploadData = await uploadResp.json()

      // Step 2: Trigger detection with the uploaded image
      // The backend auto-creates an investigation and links everything
      setProgress('Starting spill detection analysis via MODEL...')
      const detectResp = await fetch('/api/v1/spills/detect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          image_id: uploadData.image_id,
          observed_at: new Date(observedAt).toISOString(),
          bbox: coordinates,
          image_path: uploadData.image_path,
          title: title.trim() || undefined,
        }),
      })

      if (!detectResp.ok) {
        throw new Error('Failed to start detection job')
      }

      const detectData = await detectResp.json()
      const wind = toVector(measurements.windSpeed, measurements.windDirection)
      const current = toVector(measurements.currentSpeed, measurements.currentDirection)
      sessionStorage.setItem(`case-inputs-${detectData.investigation_id}`, JSON.stringify({ current_u_mps: current.u, current_v_mps: current.v, wind_u_mps: wind.u, wind_v_mps: wind.v, ais_positions: aisPositions }))
      setProgress('Detection job created! Opening investigation...')

      setTimeout(() => {
        onUploadComplete(detectData.job_id, detectData.investigation_id)
      }, 500)

      setProgress('Detection job created! Opening investigation...')

      setTimeout(() => {
        onUploadComplete(detectData.job_id, detectData.investigation_id)
      }, 500)

    } catch (err: any) {
      setError(err.message || 'Upload failed')
      setUploading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-black/60 backdrop-blur-2xl border border-white/[0.06] p-6 sm:p-8 shadow-2xl custom-scroll">
        <div className="flex items-center justify-between mb-8 border-b border-white/[0.05] pb-4">
          <h2 className="text-xl font-light tracking-tight text-white uppercase">Upload Satellite Imagery</h2>
          <button onClick={onClose} className="text-[var(--color-muted)] hover:text-white transition-colors text-2xl leading-none">&times;</button>
        </div>
        
        <div className="mt-6">
          <label className="text-xs font-mono uppercase tracking-widest text-white block mb-2">Investigation Name <span className="text-white/40 font-mono tracking-normal normal-case text-[10px]">(optional)</span></label>
          <input type="text" placeholder="e.g. Red Sea Incident" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-transparent border border-white/10 text-white font-mono text-xs p-3 focus:outline-none focus:border-white transition-colors placeholder-[var(--color-muted)]" />
        </div>

        <div className="grid grid-cols-1 gap-6 mt-6">
          <div>
            <label className="text-xs font-mono uppercase tracking-widest text-white block mb-2">Observed at</label>
            <input type="datetime-local" value={observedAt} onChange={(event) => setObservedAt(event.target.value)} className="w-full bg-transparent border border-white/10 text-white font-mono text-xs p-3 focus:outline-none focus:border-white transition-colors" required />
          </div>
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-white mb-2 flex justify-between items-center">
              <span>Incident Location (Bounding Box)</span>
              {mapClicks.length < 2 && bbox.every(v => v === '') ? (
                <span className="text-emerald-400/80 font-mono tracking-normal normal-case animate-pulse">Click twice on map to draw</span>
              ) : (
                <button type="button" onClick={() => { setMapClicks([]); setBbox(['', '', '', '']); }} className="text-emerald-400 hover:text-emerald-300 font-mono tracking-normal normal-case underline underline-offset-2">
                  Clear Selection
                </button>
              )}
            </div>
            <div className="h-[200px] w-full border border-white/10 relative overflow-hidden bg-[#050505]">
              <Map
                initialViewState={{ longitude: 0, latitude: 20, zoom: 1 }}
                mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
                onClick={handleMapClick}
                cursor={mapClicks.length === 1 ? 'crosshair' : 'default'}
                interactiveLayerIds={[]}
              >
                {getBboxGeoJSON() && (
                  <Source id="bbox-source" type="geojson" data={getBboxGeoJSON()}>
                    {mapClicks.length === 1 && (
                      <Layer id="click-point" type="circle" paint={{ 'circle-radius': 6, 'circle-color': '#34d399' }} />
                    )}
                    {mapClicks.length === 2 && (
                      <Layer id="bbox-fill" type="fill" paint={{ 'fill-color': '#34d399', 'fill-opacity': 0.2 }} />
                    )}
                    {mapClicks.length === 2 && (
                      <Layer id="bbox-line" type="line" paint={{ 'line-color': '#34d399', 'line-width': 2, 'line-dasharray': [2, 2] }} />
                    )}
                  </Source>
                )}
              </Map>
            </div>
            
            <div className="grid grid-cols-4 gap-2 mt-2">
              {bbox.map((value, index) => (
                <div key={index} className="relative">
                  <span className="absolute left-2 top-3 text-[10px] font-mono text-white/30">{['W', 'S', 'E', 'N'][index]}</span>
                  <input 
                    aria-label={['West longitude', 'South latitude', 'East longitude', 'North latitude'][index]} 
                    type="number" step="any" value={value} 
                    onChange={(event) => {
                      setBbox((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item));
                      setMapClicks([[0,0], [0,0]]); // Hack to trigger "drawn" state for clear button
                    }} 
                    className="w-full bg-transparent border border-white/10 text-white font-mono text-xs p-3 pl-6 focus:outline-none focus:border-white transition-colors" 
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-[10px] font-mono tracking-widest text-white/50 mt-6 border-l-2 border-white/20 pl-4 py-1 leading-relaxed">
          Upload a SAR or optical satellite image. The AI model will analyze it for oil spill detection,
          then run drift modelling and vessel attribution automatically.
        </p>

        <div className="grid grid-cols-2 gap-4 mt-6">
          {([['windSpeed', 'Wind speed (m/s)', '0'], ['windDirection', 'Wind dir (°)', '0–360'], ['currentSpeed', 'Current (m/s)', '0'], ['currentDirection', 'Current dir (°)', '0–360']] as const).map(([key, label, placeholder]) => (
            <div key={key}>
              <label className="text-xs font-mono uppercase tracking-widest text-white block mb-2">{label}</label>
              <input required type="number" min="0" max={key.includes('Direction') ? 360 : undefined} step="any" placeholder={placeholder} value={weather[key]} onChange={(event) => setWeather((value) => ({ ...value, [key]: event.target.value }))} className="w-full bg-transparent border border-white/10 text-white font-mono text-xs p-3 focus:outline-none focus:border-white transition-colors placeholder-[var(--color-muted)]" />
            </div>
          ))}
        </div>

        <div className="mt-8 border border-white/[0.05] p-5">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-mono uppercase tracking-widest text-white">03 // VESSEL TRAFFIC</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setAisSource('upload')} className={`text-[10px] font-mono uppercase px-3 py-1 border transition-colors ${aisSource === 'upload' ? 'bg-white text-black border-white' : 'border-white/20 text-white hover:bg-white/10'}`}>Upload CSV</button>
              <button type="button" onClick={() => setAisSource('live')} className={`text-[10px] font-mono uppercase px-3 py-1 border transition-colors ${aisSource === 'live' ? 'bg-emerald-500 text-black border-emerald-500' : 'border-white/20 text-white hover:bg-white/10'}`}>Live API Fetch</button>
            </div>
          </div>
          
          {aisSource === 'upload' ? (
            <>
              <p className="text-xs font-mono text-white/70 mb-4">Add the AIS records for this incident.</p>
              <input ref={aisInputRef} type="file" accept=".csv,text/csv" onChange={(event) => setAisFile(event.target.files?.[0] || null)} className="hidden" />
              <div className="flex items-center gap-4">
                <button type="button" onClick={() => aisInputRef.current?.click()} className="text-[10px] font-mono uppercase tracking-widest border border-white/20 px-4 py-2 hover:bg-white hover:text-black transition-colors text-white">Choose AIS CSV</button>
                <span className="text-[10px] font-mono text-white/50 truncate">{aisFile?.name || 'No file selected'}</span>
              </div>
              <div className="mt-4 flex justify-between items-end">
                <span className="text-[10px] font-mono text-white/30 tracking-wide block max-w-sm">Req: MMSI, timestamp, lat, lon, speed, course.<br/>Opt: heading, vessel_type, IMO, vessel_name.</span>
                <a href="/ais-test-data.csv" download className="text-[10px] font-mono text-white hover:underline uppercase tracking-widest">Download test data</a>
              </div>
            </>
          ) : (
            <div className="py-4 text-center border border-dashed border-emerald-500/30 bg-emerald-500/5">
              <p className="text-[10px] font-mono uppercase text-emerald-400 mb-2 tracking-widest">● LIVE SATELLITE CONNECTION</p>
              <p className="text-[10px] font-mono text-white/50">ORCA will securely query external APIs to fetch real-world AIS telemetry for your defined bounding box over the last 48 hours.</p>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-6 p-4 border border-red-500/30 bg-red-500/10">
            <p className="text-xs font-mono text-red-400">{error}</p>
          </div>
        )}

        {/* Drag & Drop Zone */}
        <div
          className={`mt-6 border border-dashed p-10 text-center cursor-pointer transition-all ${
            dragActive
              ? 'border-white bg-white/5'
              : file
              ? 'border-emerald-500/40 bg-emerald-500/5'
              : 'border-white/20 hover:border-white/40'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".tif,.tiff,.png,.jpg,.jpeg,.geotiff"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="text-2xl text-white/40 mb-3 font-light">↥</div>
          {file ? (
            <div>
              <p className="text-sm font-mono text-white mb-2">{file.name}</p>
              <p className="text-[10px] font-mono uppercase tracking-widest text-white/40">
                {(file.size / 1024 / 1024).toFixed(2)} MB // CLICK TO REPLACE
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-mono uppercase tracking-widest text-white mb-2">
                DRAG & DROP SATELLITE IMAGE
              </p>
              <p className="text-[10px] font-mono text-white/40 tracking-widest uppercase">
                GeoTIFF, TIFF, PNG, JPG // OR CLICK TO BROWSE
              </p>
            </div>
          )}
        </div>

        {/* Pipeline info */}
        <div className="mt-6 border border-white/[0.06] p-4 bg-white/[0.03] backdrop-blur-xl">
          <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-muted)] mb-3">PIPELINE SEQUENCE</div>
          <div className="flex items-center gap-3 text-[10px] font-mono text-white/50 uppercase tracking-widest">
            <span className="text-white">Upload</span>
            <span className="text-white/20">→</span>
            <span>MODEL /detect</span>
            <span className="text-white/20">→</span>
            <span>MODEL /drift</span>
            <span className="text-white/20">→</span>
            <span>MODEL /attribution</span>
          </div>
        </div>

        {/* Status */}
        {uploading && (
          <div className="mt-6 flex items-center gap-4 border border-white/[0.05] p-4">
            <div className="w-4 h-4 border border-white border-t-transparent animate-spin" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-white">{progress}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4 mt-8 pt-6 border-t border-white/[0.05]">
          <button onClick={onClose} className="flex-1 text-[10px] font-mono uppercase tracking-widest border border-white/20 py-4 hover:bg-white/5 transition-colors text-white" disabled={uploading}>
            CANCEL
          </button>
          <button
            onClick={handleUploadAndDetect}
            className={`flex-1 text-[10px] font-mono uppercase tracking-widest py-4 transition-colors ${file && !uploading ? 'bg-white text-black hover:bg-white/90' : 'bg-white/10 text-white/30 cursor-not-allowed'}`}
            disabled={!file || uploading}
          >
            {uploading ? 'PROCESSING...' : 'UPLOAD & ANALYZE'}
          </button>
        </div>
      </div>
    </div>
  )
}
