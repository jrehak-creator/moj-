import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { coverArtworkFor } from '../shared/covers.mjs';

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError' | 'title'> & {
  thumbnail?: string;
  artwork?: string;
  title?: string;
  description?: string;
};

const artworks = ['ocean', 'forest', 'space', 'bears', 'butterfly', 'music', 'stories', 'earth'];

export default function VideoCover({ thumbnail = '', artwork, title = '', description = '', alt = '', loading = 'lazy', ...props }: Props) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [thumbnail]);
  const cover = artwork && artworks.includes(artwork) ? artwork : coverArtworkFor({ title, description });
  return <img {...props} alt={alt} loading={loading} src={thumbnail && !failed ? thumbnail : `/artwork/${cover}.svg`} onError={() => setFailed(true)} />;
}
