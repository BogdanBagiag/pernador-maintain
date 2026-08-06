import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { X, Save, Loader2 } from 'lucide-react'

// ═════════════════════════════════════════════════════════════
// Modal comun de adăugare/editare client — folosit atât din Comenzi cât și din
// Datorii Clienți, ambele module scriind în același tabel unificat "clienti".
// Câmpurile sunt identice în ambele locuri: Client, CIF, Email, Telefon, Adresă,
// Observații.
// ═════════════════════════════════════════════════════════════
export default function ClientModal({ client, onClose, onSaved }) {
  const [nume, setNume] = useState(client?.nume || '')
  const [cif, setCif] = useState(client?.cif || '')
  const [email, setEmail] = useState(client?.email || '')
  const [telefon, setTelefon] = useState(client?.telefon || '')
  const [adresa, setAdresa] = useState(client?.adresa || '')
  const [observatii, setObservatii] = useState(client?.observatii || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const isEdit = !!client

  const handleSave = async () => {
    if (!nume.trim()) return
    setSaving(true)
    setError('')
    const numeTrim = nume.trim()
    const payload = {
      nume: numeTrim,
      cif: cif.trim() || null,
      email: email.trim() || null,
      telefon: telefon.trim() || null,
      adresa: adresa.trim() || null,
      observatii: observatii.trim() || null,
    }

    // Verifică dacă mai există un alt client cu exact același nume (fără majuscule/spații
    // în plus) — dacă da, se unifică automat cu acela, în loc să se creeze un duplicat.
    const { data: existenti, error: eList } = await supabase
      .from('clienti')
      .select('id, nume, cif, email, telefon, adresa, observatii')
    if (eList) { setSaving(false); setError(eList.message); return }
    const dublura = (existenti || []).find(
      c => c.id !== client?.id && c.nume.trim().toLowerCase() === numeTrim.toLowerCase()
    )

    if (dublura) {
      const mesaj = isEdit
        ? `Există deja un client "${dublura.nume}". "${client.nume}" va fi unificat cu acesta — comenzile și datoriile lui se mută automat, iar acest client va fi șters. Continui?`
        : `Există deja un client "${dublura.nume}". Datele completate se vor adăuga la acesta, fără să se creeze un client nou. Continui?`
      if (!window.confirm(mesaj)) { setSaving(false); return }

      const completat = {
        cif: dublura.cif || payload.cif,
        email: dublura.email || payload.email,
        telefon: dublura.telefon || payload.telefon,
        adresa: dublura.adresa || payload.adresa,
        observatii: dublura.observatii || payload.observatii,
      }
      const { error: eUpd } = await supabase.from('clienti').update(completat).eq('id', dublura.id)
      if (eUpd) { setSaving(false); setError(eUpd.message); return }

      if (isEdit && client.id !== dublura.id) {
        const { error: e1 } = await supabase.from('com_comenzi').update({ client_id: dublura.id }).eq('client_id', client.id)
        if (e1) { setSaving(false); setError(e1.message); return }
        const { error: e2 } = await supabase.from('datorii_facturi').update({ client_id: dublura.id }).eq('client_id', client.id)
        if (e2) { setSaving(false); setError(e2.message); return }
        const { error: e3 } = await supabase.from('clienti').delete().eq('id', client.id)
        if (e3) { setSaving(false); setError(e3.message); return }
      }
      setSaving(false)
      onSaved()
      return
    }

    const { error: err } = isEdit
      ? await supabase.from('clienti').update(payload).eq('id', client.id)
      : await supabase.from('clienti').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">{isEdit ? 'Editează Client' : 'Client Nou'}</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-4 space-y-4">
          {[
            { label: 'Client',  val: nume,    set: setNume,    required: true },
            { label: 'CIF',     val: cif,     set: setCif },
            { label: 'Email',   val: email,   set: setEmail,   type: 'email' },
            { label: 'Telefon', val: telefon, set: setTelefon },
          ].map(({ label, val, set, required, type }) => (
            <div key={label}>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                {label} {required && <span className="text-red-400">*</span>}
              </label>
              <input type={type || 'text'} value={val} onChange={e => set(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                autoFocus={label === 'Client'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Adresă</label>
            <textarea value={adresa} onChange={e => setAdresa(e.target.value)} rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Observații</label>
            <textarea value={observatii} onChange={e => setObservatii(e.target.value)} rows={3}
              placeholder="Note libere despre acest client..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400 resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Anulează</button>
          <button onClick={handleSave} disabled={saving || !nume.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvează
          </button>
        </div>
      </div>
    </div>
  )
}
