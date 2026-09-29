import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import Icon from './Icon';

/**
 * A dropdown that also accepts anything typed into it.
 *
 * Replaces `<input list>` + `<datalist>`, which looks like the right element
 * and is not: it only opens once you start typing, it matches on substring
 * with no say in the matter, it cannot be styled, and Chrome, Firefox and
 * Safari each do something different with it. The result reads as broken even
 * when it is working.
 *
 * This behaves the way people expect a dropdown to: clicking shows every
 * option, typing filters them, the arrow keys and Enter work, and a value that
 * is not on the list is still accepted — which matters here, because the list
 * is a set of suggestions rather than the permitted values.
 */

export interface ComboboxProps {
  value: string;
  onChange: (next: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  /** Offer to keep a typed value that is not on the list. Default true. */
  allowCustom?: boolean;
  id?: string;
  className?: string;
}

export const Combobox: React.FC<ComboboxProps> = ({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  allowCustom = true,
  id,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  /** What is being typed. Null means "showing the committed value". */
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();

  const text = query ?? value;

  /* An empty query shows everything: opening the field should reveal the list,
     not an empty box waiting to be typed into. */
  const matches = useMemo(() => {
    const needle = (query ?? '').trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => option.toLowerCase().includes(needle));
  }, [options, query]);

  const custom =
    allowCustom &&
    Boolean(query?.trim()) &&
    !options.some((option) => option.toLowerCase() === query!.trim().toLowerCase());

  /* Close on an outside click. Without this the list stays over the page and
     the next click lands on whatever is underneath it. */
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(event.target as Node)) close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  /* Keep the keyboard selection visible: the list scrolls, and arrowing past
     the bottom of it would otherwise highlight a row nobody can see. */
  useEffect(() => {
    if (!open) return;
    list.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const close = () => {
    setOpen(false);
    setQuery(null);
    setActive(0);
  };

  const commit = (next: string) => {
    onChange(next);
    close();
  };

  const rows = custom ? [query!.trim(), ...matches] : matches;

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActive((current) => {
        const next = event.key === 'ArrowDown' ? current + 1 : current - 1;
        if (next < 0) return rows.length - 1;
        if (next >= rows.length) return 0;
        return next;
      });
      return;
    }

    if (event.key === 'Enter') {
      /* Inside a form this would submit it before the pick registers. */
      event.preventDefault();
      if (open && rows[active] !== undefined) commit(rows[active]);
      else if (query !== null) commit(query.trim());
      return;
    }

    if (event.key === 'Escape' && open) {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === 'Tab' && open) close();
  };

  return (
    <div ref={wrap} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={input}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
          value={text}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => !disabled && setOpen(true)}
          onKeyDown={onKeyDown}
          className="w-full pl-3 pr-9 py-2 rounded-xl bg-white border border-slate-200 text-sm text-on-surface
            placeholder:text-outline/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15
            transition-all disabled:bg-slate-50 disabled:text-outline disabled:cursor-not-allowed cursor-text"
        />

        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label={open ? 'Close the list' : 'Show the list'}
          onClick={() => {
            if (disabled) return;
            if (open) {
              close();
            } else {
              setOpen(true);
              input.current?.focus();
            }
          }}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center
            text-outline hover:bg-slate-100 disabled:cursor-not-allowed disabled:hover:bg-transparent cursor-pointer"
        >
          <Icon
            name="expand_more"
            size="sm"
            className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {open && (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-xl bg-white
            border border-slate-200 shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100"
        >
          {rows.length === 0 && (
            <li className="px-3 py-2 text-xs text-outline">No match — type your own</li>
          )}

          {rows.map((option, index) => {
            const isCustom = custom && index === 0;
            return (
              <li key={`${option}-${index}`} role="option" aria-selected={option === value}>
                <button
                  type="button"
                  /* Mouse down, not click: the input blurs first otherwise and
                     the list closes before the click ever lands. */
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commit(option);
                  }}
                  onMouseEnter={() => setActive(index)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 cursor-pointer transition-colors ${
                    index === active ? 'bg-primary/10 text-primary' : 'text-on-surface hover:bg-slate-50'
                  }`}
                >
                  {isCustom ? (
                    <>
                      <Icon name="add" size="xs" />
                      <span>
                        Use <strong>{option}</strong>
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 truncate">{option}</span>
                      {option === value && <Icon name="check" size="xs" color="primary" />}
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default Combobox;
