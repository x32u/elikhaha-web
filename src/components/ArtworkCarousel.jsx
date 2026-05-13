import React, { useState } from 'react';
import { useStoredUserSettings } from '../hooks/useStoredUserSettings';
import { shouldLoadRichMedia } from '../utils/userSettings';
import './ArtworkCarousel.css';

const ArtworkCarousel = ({ artworks, onArtworkClick }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const settings = useStoredUserSettings();
  const initialDisplayCount = 2;
  const displayedArtworks = isExpanded ? artworks : artworks.slice(0, initialDisplayCount);
  const hasMore = artworks.length > initialDisplayCount;

  return (
    <div className="artworks-section">
      <h2 className="section-title">Recent Artworks</h2>
      <div className="artworks-container">
        <div className="artworks-scroll">
          {displayedArtworks.map((artwork, index) => {
            const canLoadImage = shouldLoadRichMedia(settings) && artwork.image;
            return (
              <button
                key={artwork.id || index}
                type="button"
                className={`artwork-card ${canLoadImage ? 'has-image' : ''}`}
                onClick={() => onArtworkClick?.(artwork)}
              >
                {canLoadImage ? (
                  <img src={artwork.image} alt={artwork.title} />
                ) : (
                  <div className={`artwork-placeholder color-${(index % 4) + 1}`}>
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM11 13l-2.5 3.01L6 13l-3 4h18l-6-8z"/>
                    </svg>
                  </div>
                )}
                <div className="artwork-card-footer">
                  <span className="artwork-title">{artwork.title || 'Untitled Artwork'}</span>
                </div>
              </button>
            );
          })}
        </div>
        {hasMore && (
          <button 
            className="expand-button"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? 'Show Less' : `Show More (${artworks.length - initialDisplayCount} more)`}
            <svg 
              className={`expand-icon ${isExpanded ? 'expanded' : ''}`}
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default ArtworkCarousel;
