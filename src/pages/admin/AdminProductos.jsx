import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function AdminProductos() {
  const [prods,  setProds]  = useState([])
  const [filtro, setFiltro] = useState('activo')
  const navigate = useNavigate()

  useEffect(() => { load() }, [filtro])

  const load = async () => {
    const { data } = await supabase.from('productos').select('*, categorias(nombre), empresas(razon_social,nif)').eq('estado', filtro).order('created_at', { ascending: false })
    setProds(data || [])
  }

  const moderar = async (id, estado) => {
    await supabase.from('productos').update({ estado }).eq('id', id)
    setProds(p => p.filter(x => x.id !== id))
  }

  return (
    <div>
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        {['activo','suspendido'].map(f => (
          <button key={f} className={"admin-filter-btn"+(filtro===f?' active':'')} onClick={() => setFiltro(f)}>
            {f.charAt(0).toUpperCase()+f.slice(1)}
          </button>
        ))}
      </div>
      <div style={{background:'white',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}}>
        <div className="admin-row admin-row-header" style={{gridTemplateColumns:'1.5fr 1fr 100px 100px'}}>
          <span>Producto</span><span>Empresa</span><span>Categoría</span><span>Acciones</span>
        </div>
        {prods.map(p => (
          <div key={p.id} className="admin-row" style={{gridTemplateColumns:'1.5fr 1fr 100px 100px'}}>
            <div>
              <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:'var(--navy)',fontSize:'.83rem'}}>{p.nombre}</div>
              <div style={{color:'var(--text-muted)',fontSize:'.71rem',marginTop:2}}>{(p.descripcion||'').slice(0,70)}...</div>
            </div>
            <div style={{fontSize:'.81rem'}}>{p.empresas?.razon_social||'-'}<br/><span style={{color:'var(--text-muted)',fontSize:'.71rem'}}>{p.empresas?.nif||''}</span></div>
            <div style={{fontSize:'.81rem'}}>{p.categorias?.nombre||'-'}</div>
            <div className="admin-actions-cell" style={{flexDirection:'column',gap:4}}>
              <button className={"admin-btn "+(filtro==='activo'?'admin-btn-reject':'admin-btn-approve')} onClick={() => moderar(p.id, filtro==='activo'?'suspendido':'activo')}>
                {filtro==='activo'?'Suspender':'Activar'}
              </button>
              <button className="admin-btn admin-btn-edit" onClick={() => navigate('/producto/'+p.id)}>Ver</button>
            </div>
          </div>
        ))}
        {!prods.length && <div style={{padding:24,textAlign:'center',color:'var(--text-muted)',fontSize:'.85rem'}}>No hay productos con este estado.</div>}
      </div>
    </div>
  )
}
