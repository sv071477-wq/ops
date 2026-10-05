import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { FullscreenTable, PlainHeaderCell, SortableHeaderCell, TableFilters } from '@/components/table';
import { useTableFilters, type TableFilterField } from '@/hooks/useTableFilters';
import { useTableSort } from '@/hooks/useTableSort';
import type { SortAccessors } from '@/lib/tableUtils';

interface Row {
  name: string;
  team: string;
}

const ROWS: Row[] = [
  { name: "Beta", team: "Delivery" },
  { name: "Alpha", team: "Finance" },
];

const ACCESSORS: SortAccessors<Row> = {
  name: (row) => row.name,
  team: (row) => row.team,
};

const FIELDS: readonly TableFilterField<Row>[] = [{ key: 'team', accessor: ACCESSORS.team }];

function SortableHarness() {
  const { sortKey, sortDir, sortedRows, toggleSort } = useTableSort(ROWS, ACCESSORS);
  const { filteredRows, search, setSearch } = useTableFilters(sortedRows, FIELDS);
  const rows = search ? filteredRows : sortedRows;

  return (
    <table>
      <thead>
        <tr>
          <SortableHeaderCell columnKey="name" label="Name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
          <PlainHeaderCell>Action</PlainHeaderCell>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.name}>
            <td>{row.name}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FiltersHarness() {
  const [rows] = useState(ROWS);
  const { search, setSearch, getFilter, setFilter, optionsFor, clearFilters, hasActiveFilters } = useTableFilters(
    rows,
    FIELDS
  );

  return (
    <TableFilters
      search={{ value: search, onChange: setSearch, placeholder: 'Search people' }}
      selects={[
        {
          key: 'team',
          label: 'Team',
          value: getFilter('team'),
          onChange: (value) => setFilter('team', value),
          options: optionsFor('team'),
          allLabel: 'All teams',
        },
      ]}
      onClear={clearFilters}
      hasActiveFilters={hasActiveFilters}
    />
  );
}

describe('SortableHeaderCell', () => {
  it('reports the unsorted state to assistive tech', () => {
    render(
      <table>
        <thead>
          <tr>
            <SortableHeaderCell columnKey="name" label="Name" sortKey={null} sortDir={null} onSort={() => {}} />
          </tr>
        </thead>
      </table>
    );
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'none');
  });

  it('reports the active direction and asks to sort through the header', async () => {
    const onSort = vi.fn();
    render(
      <table>
        <thead>
          <tr>
            <SortableHeaderCell columnKey="name" label="Name" sortKey="name" sortDir="desc" onSort={onSort} />
          </tr>
        </thead>
      </table>
    );
    const header = screen.getByRole('columnheader');
    expect(header).toHaveAttribute('aria-sort', 'descending');

    await userEvent.click(screen.getByRole('button', { name: /Name/ }));
    expect(onSort).toHaveBeenCalledWith('name');
  });
});

describe('useTableSort', () => {
  it('cycles a column through ascending, descending and unsorted', async () => {
    render(<SortableHarness />);
    const header = screen.getByRole('button', { name: /Name/ });
    const nameHeader = () => screen.getAllByRole('columnheader')[0];
    const names = () => screen.getAllByRole('row').slice(1).map((row) => row.textContent);

    expect(names()).toEqual(['Beta', 'Alpha']);

    await userEvent.click(header);
    expect(names()).toEqual(['Alpha', 'Beta']);
    expect(nameHeader()).toHaveAttribute('aria-sort', 'ascending');

    await userEvent.click(header);
    expect(names()).toEqual(['Beta', 'Alpha']);
    expect(nameHeader()).toHaveAttribute('aria-sort', 'descending');

    await userEvent.click(header);
    expect(nameHeader()).toHaveAttribute('aria-sort', 'none');
  });

  it('starts newest/biggest first for columns listed in descFirstKeys', async () => {
    function Harness() {
      const { sortKey, sortDir, sortedRows, toggleSort } = useTableSort(ROWS, ACCESSORS, {
        descFirstKeys: ['name'],
      });
      return (
        <table>
          <thead>
            <tr>
              <SortableHeaderCell columnKey="name" label="Name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: /Name/ }));

    // The descending indicator must match the descending row order.
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'descending');
    expect(screen.getAllByRole('row').slice(1).map((row) => row.textContent)).toEqual(['Beta', 'Alpha']);
  });
});

describe('TableFilters', () => {
  it('filters rows by the search box', async () => {
    render(<FiltersHarness />);
    await userEvent.type(screen.getByLabelText('Search'), 'alph');
    expect(screen.getByLabelText('Search')).toHaveValue('alph');
  });

  it('gives every control in a row its own unique id', () => {
    render(
      <>
        <FiltersHarness />
        <FiltersHarness />
      </>,
    );
    const ids = screen.getAllByLabelText('Team').map((select) => select.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it('offers the distinct column values and an all option', () => {
    render(<FiltersHarness />);
    const select = screen.getByLabelText('Team') as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual([
      'All teams',
      'Delivery',
      'Finance',
    ]);
  });

  it('reveals the clear action only once a filter is active', async () => {
    render(<FiltersHarness />);
    expect(screen.queryByRole('button', { name: /Clear/ })).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Team'), 'Finance');
    const clear = screen.getByRole('button', { name: /Clear/ });

    await userEvent.click(clear);
    expect(screen.getByLabelText('Team')).toHaveValue('');
  });
});

describe('FullscreenTable', () => {
  it('toggles fullscreen and exits on Escape', async () => {
    const { container } = render(
      <FullscreenTable title="Ledger">
        <table>
          <tbody>
            <tr>
              <td>row</td>
            </tr>
          </tbody>
        </table>
      </FullscreenTable>
    );

    const panel = container.firstElementChild as HTMLElement;
    expect(panel).toHaveAttribute('data-fullscreen', 'false');

    await userEvent.click(screen.getByRole('button', { name: /Full Screen/ }));
    expect(panel).toHaveAttribute('data-fullscreen', 'true');

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(panel).toHaveAttribute('data-fullscreen', 'false');
  });

  it('keeps the fullscreen button out of the way when hidden', () => {
    render(
      <FullscreenTable showFullscreenButton={false} toolbar={<span>toolbar</span>}>
        <table>
          <tbody />
        </table>
      </FullscreenTable>
    );
    expect(screen.queryByRole('button', { name: /Full Screen/ })).not.toBeInTheDocument();
    expect(screen.getByText('toolbar')).toBeInTheDocument();
  });

  it('keeps its header rows intact when headerStyle tries to own the layout', () => {
    const { container } = render(
      <FullscreenTable
        title="Ledger"
        // A caller can theme the padding/border, but must not be able to
        // collapse the header rows or reorder the toolbar and actions.
        headerStyle={{
          padding: '20px 24px',
          borderBottom: '1px solid red',
          display: 'grid',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}
        toolbar={<span>toolbar</span>}
        actions={<button type="button">Do the thing</button>}
      >
        <table>
          <tbody />
        </table>
      </FullscreenTable>
    );

    const header = container.querySelector<HTMLElement>('[style*="border-bottom"]') as HTMLElement;
    expect(header).not.toBeNull();
    expect(header.style.flexDirection).toBe('column');
    expect(header.style.alignItems).toBe('stretch');
    expect(header.style.display).toBe('flex');
    // The caller's theme still applies.
    expect(header.style.padding).toBe('20px 24px');
    expect(header.style.borderBottom).toBe('1px solid red');

    // Title sits on its own line; the toolbar and the actions share the row
    // underneath it so a table's primary button lines up with its filters.
    const title = screen.getByText('Ledger');
    const toolbarControl = screen.getByText('toolbar');
    const toolbarRow = header.lastElementChild as HTMLElement;
    expect(title.parentElement).toBe(header);
    expect(header.children).toHaveLength(2);
    expect(toolbarRow.contains(toolbarControl)).toBe(true);
    expect(toolbarRow.contains(screen.getByRole('button', { name: 'Do the thing' }))).toBe(true);
  });
});