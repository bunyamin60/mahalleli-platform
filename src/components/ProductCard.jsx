import ProductImage from './ProductImage'

function ProductCard({ product, stock, disabled = false, inCart = false, onAdd }) {
  const soldOut = typeof stock === 'number' && stock <= 0
  const cannotAdd = disabled || soldOut || inCart

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-square overflow-hidden bg-slate-100">
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          className="aspect-square h-full w-full rounded-t-xl object-cover transition-transform duration-300 group-hover:scale-105"
          placeholderClassName="absolute inset-0 aspect-square h-full w-full rounded-t-xl"
        />
        <span className="absolute left-2 top-2 rounded-full border border-indigo-200/60 bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700 shadow-sm backdrop-blur">
          {product.categoryLabel || product.category}
        </span>
        {soldOut && (
          <span className="absolute right-2 top-2 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 ring-1 ring-red-200">
            Tükendi
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-slate-900 md:text-base">
          {product.name}
        </h3>
        <p className="text-xs text-slate-500">Birim: {product.unit}</p>
        {typeof stock === 'number' && stock > 0 && (
          <p className="text-xs font-medium text-blue-600">Kalan stok: {stock}</p>
        )}
        <p className="mt-auto text-lg font-extrabold text-emerald-600">{product.price} TL</p>

        {inCart ? (
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-xl border border-emerald-200/60 bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-700"
          >
            Sepete Eklendi (1/1)
          </button>
        ) : (
          <button
            type="button"
            onClick={onAdd}
            disabled={cannotAdd}
            className="w-full rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            Sepete Ekle
          </button>
        )}
      </div>
    </article>
  )
}

export default ProductCard
