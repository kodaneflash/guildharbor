import Image from "next/image";
import { resourceFiles } from "@/domains/delivery/file-service";
import { removeListingImage } from "@/app/(product)/seller/listings/media-actions";
export async function ListingGallery({ id, title, editable = false }: { id: string; title: string; editable?: boolean }) {
  const files = await resourceFiles("listing_media", id);
  if (!files.length) return null;
  return <ul className="grid gap-4 sm:grid-cols-2" aria-label="Listing images">{files.map((file, index) => <li key={file.id} className="space-y-2"><a href={`/api/files/${file.id}?preview=1`} target="_blank" rel="noopener noreferrer" aria-label={`View ${title} image ${index + 1}`}><Image src={`/api/files/${file.id}?preview=1`} alt={`${title} — image ${index + 1}`} width={720} height={480} unoptimized className="aspect-[3/2] w-full rounded-lg object-contain" /></a>{editable && <form action={removeListingImage}><input type="hidden" name="id" value={file.id} /><input type="hidden" name="listingId" value={id} /><button className="button-secondary">Remove image {index + 1}</button></form>}</li>)}</ul>;
}
