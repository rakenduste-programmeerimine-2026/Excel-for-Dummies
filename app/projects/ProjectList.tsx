'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ui } from '@/lib/strings.et';
import { DeleteProjectButton } from './DeleteProjectButton';
import { matchesSearch, type SearchableProject } from './matchesSearch';
import styles from './page.module.css';

const t = ui.projects;

type Project = SearchableProject & { id: string };

export function ProjectList({ projects }: { projects: Project[] }) {
  const [query, setQuery] = useState('');
  const shown = projects.filter((project) => matchesSearch(project, query));

  return (
    <>
      <label htmlFor="project-search" className={styles.srOnly}>
        {t.search}
      </label>
      <input
        id="project-search"
        type="search"
        className={`${styles.input} ${styles.search}`}
        value={query}
        placeholder={t.searchPlaceholder}
        autoComplete="off"
        onChange={(e) => setQuery(e.target.value)}
      />
      {/* Tells screen reader users the list changed while they type. */}
      <p role="status" className={styles.srOnly}>
        {query.trim() ? t.resultCount(shown.length) : ''}
      </p>

      {shown.length === 0 ? (
        <p className={styles.empty}>{t.noResults}</p>
      ) : (
        <ul className={styles.list}>
          {shown.map((project) => {
            const details = [project.client, project.address].filter(Boolean).join(' · ');
            return (
              <li key={project.id} className={styles.card}>
                <Link href={`/projects/${project.id}`} className={styles.cardLink}>
                  <span className={styles.cardName}>{project.name}</span>
                  {details && <span className={styles.cardDetails}>{details}</span>}
                </Link>
                <DeleteProjectButton id={project.id} name={project.name} />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
