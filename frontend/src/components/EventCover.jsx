/** Category "posters" used when an event has no uploaded image. */
export const CATEGORY_COLORS = {
  Community: { bg: '#F2A900', fg: '#18233D' },
  'Sports & Fitness': { bg: '#E8604C', fg: '#FFF8F0' },
  Education: { bg: '#3B4FC4', fg: '#F5F7FF' },
  'Arts & Culture': { bg: '#8E3B8A', fg: '#FFF3FC' },
  'Health & Wellness': { bg: '#4FA48A', fg: '#0E2A22' },
  Volunteering: { bg: '#F07C3A', fg: '#2A1406' },
  Environment: { bg: '#2F7D45', fg: '#EFFAF1' },
  Technology: { bg: '#18233D', fg: '#F2A900' },
  'Food & Drink': { bg: '#C9472F', fg: '#FFF4E6' },
  Music: { bg: '#2D8FD5', fg: '#06223A' },
};

export const categoryColor = (c) => CATEGORY_COLORS[c] || { bg: '#5B6478', fg: '#FFFFFF' };

export default function EventCover({ event, size = 'card' }) {
  if (event.imageUrl) {
    return (
      <div className={`cover cover-${size}`}>
        <img src={event.imageUrl} alt="" loading="lazy" />
      </div>
    );
  }
  const { bg, fg } = categoryColor(event.category);
  return (
    <div className={`cover cover-${size} cover-poster`} style={{ '--poster-bg': bg, '--poster-fg': fg }} aria-hidden="true">
      <span className="poster-word">{event.category}</span>
    </div>
  );
}
