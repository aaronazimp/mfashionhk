export const ListStatusLabel: Record<string, string> = {
  waitlist: '待補貨',
  allocated: '待通知',
  confirmed: '待付款',
  paid: '待核數',
  verified: '待執貨',
  pending_to_ship: '待寄貨',
  pre_pending_to_ship: '執貨中',
  shipped: '已寄出',
  cancelled:'已取消',
};

export const ListStatusBg: Record<string, string> = {
  waitlist: 'bg-fuchsia-100',
  allocated: 'bg-yellow-100',
  confirmed: 'bg-orange-100',
  paid: 'bg-blue-100',
  verified: 'bg-emerald-100',
  pending_to_ship: 'bg-lime-100',
  pre_pending_to_ship: 'bg-violet-100',
  shipped: 'bg-teal-100',
  cancelled: 'bg-stone-100',
};

export const OrderStatusLabel: Record<string, string> = {
  waitlist: '候補中',
  pending: '候補中',
  allocated: '待通知',
  confirmed: '待付款',
  paid: '待核數',
  verified: '待執貨',
  completed: '已完成',
  pending_to_ship: '待寄出',
  pre_pending_to_ship: '執貨中',
  shipped: '已寄出',
  cancelled: '已取消',
  void: '已取消',
  refunded: '已退款',
  processing: '處理中',
};

export const OrderStatusStyleMap: Record<string, string> = {
  // Status styles — ensure each status from OrderStatusLabel has a distinct color
  waitlist: '!bg-fuchsia-100 !text-fuchsia-800 !border-fuchsia-200 gap-1',
  pending: '!bg-amber-100 !text-amber-800 !border-amber-200 gap-1',
  allocated: '!bg-yellow-100 !text-yellow-800 !border-yellow-200 gap-1',
  confirmed: '!bg-orange-100 !text-orange-800 !border-orange-200 gap-1',
  paid: '!bg-blue-100 !text-blue-800 !border-blue-200 gap-1',
  verified: '!bg-emerald-100 !text-emerald-800 !border-emerald-200 gap-1',
  completed: '!bg-green-100 !text-green-800 !border-green-200 gap-1',
  pending_to_ship: '!bg-lime-100 !text-lime-800 !border-lime-200 gap-1',
  pre_pending_to_ship: '!bg-violet-100 !text-violet-800 !border-violet-200 gap-1',
  shipped: '!bg-teal-100 !text-teal-800 !border-teal-200 gap-1',
  cancelled: '!bg-stone-100 !text-stone-800 !border-stone-200 gap-1',
  void: '!bg-slate-50 !text-slate-700 !border-slate-200 gap-1',
  refunded: '!bg-rose-100 !text-rose-800 !border-rose-200 gap-1',
  processing: '!bg-indigo-100 !text-indigo-800 !border-indigo-200 gap-1',

  // Additional legacy/aux keys kept for compatibility with distinct colors
 
  archived: '!bg-cyan-100 !text-cyan-800 !border-cyan-200 gap-1',
};
