import { Icon } from '@/app/_components/icons';

/** Dòng nhắc CHỈ hiện trên mobile: màn này tối ưu cho máy tính. */
export default function PcHint() {
  return (
    <p className="admin-pc-hint" role="note">
      <Icon name="info" size={15} /> Màn này tối ưu cho máy tính — thao tác đầy đủ nên dùng PC.
    </p>
  );
}
