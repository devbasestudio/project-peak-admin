"use client";

import { Trash2 } from "lucide-react";
import { deletePost } from "@/app/website-actions";

export function DeletePostButton({ id }: { id: string }) {
  return <form action={deletePost.bind(null, id)} onSubmit={(event) => { if (!window.confirm("ဒီ post ကို အပြီးဖျက်မှာ သေချာပါသလား?")) event.preventDefault(); }}><button className="grid h-10 w-10 place-items-center rounded-lg border border-red-200 text-red-600 transition hover:bg-red-50" aria-label="Delete post"><Trash2 size={16} /></button></form>;
}
