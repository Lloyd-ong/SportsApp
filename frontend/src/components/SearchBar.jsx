function SearchBar({ value, onChange, onSubmit, onClear, placeholder = 'Search by sport, location, or team vibe' }) {
  return (
    <form
      className="search-bar"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <button type="submit" className="btn btn--primary btn--icon-only" aria-label="Search">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <span className="sr-only">Search</span>
      </button>
      {value ? (
        <button type="button" className="btn btn--ghost" onClick={onClear}>
          Clear
        </button>
      ) : null}
    </form>
  );
}

export default SearchBar;
