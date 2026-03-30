import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { invalidateContentCache } from '@/hooks/useSiteContent';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Save, Loader2, ChevronDown, ChevronRight, ExternalLink, Plus, Trash2 } from 'lucide-react';

const PAGES = [
  { key: 'brand', label: 'Brand', path: '/' },
  { key: 'landing', label: 'Homepage', path: '/' },
  { key: 'about', label: 'About', path: '/about' },
  { key: 'closed_table', label: 'Closed Table', path: '/closed-table' },
  { key: 'private_table', label: 'Private Table', path: '/private-table' },
  { key: 'sunday_table', label: 'Sunday Table', path: '/sunday-table' },
  { key: 'network', label: 'Ragers', path: '/network' },
  { key: 'contact', label: 'Contact', path: '/contact' },
  { key: 'legal', label: 'Legal', path: '/privacy' },
];

function setDeep(obj, path, value) {
  const copy = JSON.parse(JSON.stringify(obj));
  const parts = path.split('.');
  let cur = copy;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = isNaN(parts[i]) ? parts[i] : parseInt(parts[i]);
    if (cur[k] === undefined) cur[k] = {};
    cur = cur[k];
  }
  const last = isNaN(parts[parts.length - 1]) ? parts[parts.length - 1] : parseInt(parts[parts.length - 1]);
  cur[last] = value;
  return copy;
}

function emptyClone(val) {
  if (Array.isArray(val)) return [];
  if (typeof val === 'object' && val !== null) {
    const out = {};
    for (const k of Object.keys(val)) out[k] = emptyClone(val[k]);
    return out;
  }
  return '';
}

function flattenFields(obj, prefix) {
  const fields = [];
  if (!obj || typeof obj !== 'object') return fields;
  Object.entries(obj).forEach(function(entry) {
    var k = entry[0];
    var v = entry[1];
    var path = prefix ? prefix + '.' + k : k;
    if (v === null || v === undefined) {
      fields.push({ path: path, type: 'string', value: '', label: k });
    } else if (typeof v === 'string') {
      fields.push({ path: path, type: v.length > 80 ? 'textarea' : 'string', value: v, label: k });
    } else if (typeof v === 'number') {
      fields.push({ path: path, type: 'number', value: v, label: k });
    } else if (Array.isArray(v)) {
      fields.push({ path: path, type: 'array', value: v, label: k });
    } else if (typeof v === 'object') {
      fields.push({ path: path, type: 'object', value: v, label: k });
    }
  });
  return fields;
}

export default function AdminContentEditor() {
  var ref = useState([]);
  var allContent = ref[0];
  var setAllContent = ref[1];
  var ref2 = useState('landing');
  var activePage = ref2[0];
  var setActivePage = ref2[1];
  var ref3 = useState(null);
  var editing = ref3[0];
  var setEditing = ref3[1];
  var ref4 = useState(false);
  var saving = ref4[0];
  var setSaving = ref4[1];
  var ref5 = useState(true);
  var loading = ref5[0];
  var setLoading = ref5[1];

  var fetchAll = useCallback(function() {
    return api.get('/admin/content').then(function(res) { setAllContent(res.data); }).catch(function() { toast.error('Failed to load'); }).finally(function() { setLoading(false); });
  }, []);

  useEffect(function() { fetchAll(); }, [fetchAll]);

  useEffect(function() {
    var doc = allContent.find(function(c) { return c.page === activePage; });
    setEditing(doc ? JSON.parse(JSON.stringify(doc.sections)) : null);
  }, [activePage, allContent]);

  var handleSave = function() {
    setSaving(true);
    api.put('/admin/content/' + activePage, { sections: editing })
      .then(function() { invalidateContentCache(activePage); toast.success(activePage + ' saved'); fetchAll(); })
      .catch(function(err) { toast.error((err.response && err.response.data && err.response.data.detail) || 'Failed'); })
      .finally(function() { setSaving(false); });
  };

  var updateField = function(path, value) {
    setEditing(function(prev) { return setDeep(prev, path, value); });
  };

  var handleSeed = function() {
    setSaving(true);
    api.post('/admin/content/seed')
      .then(function() { toast.success('Content seeded'); fetchAll(); })
      .catch(function() { toast.error('Seed failed'); })
      .finally(function() { setSaving(false); });
  };

  if (loading) return <div className="flex items-center justify-center h-40 text-[#A1A1AA]"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  if (!editing) return (
    <div className="border border-white/5 bg-[#0A0A0A] p-10 text-center">
      <p className="text-[#71717A] mb-4">No content found. Click below to seed default content for all pages.</p>
      <button onClick={handleSeed} disabled={saving} className="inline-flex items-center gap-2 bg-[#DC143C] hover:bg-[#B01030] text-white px-6 py-2 text-xs uppercase tracking-wider font-semibold transition-colors">
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
        Seed Default Content
      </button>
    </div>
  );

  var sectionKeys = Object.keys(editing);

  return (
    <div data-testid="admin-content-editor">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-[#DC143C] mb-2 font-semibold">Admin</p>
        <h1 className="text-3xl font-light text-[#F5F5F0] tracking-tight">Content</h1>
        <p className="text-sm text-[#52525B] mt-1">Edit page copy, logos, and site content.</p>
      </div>
      <div className="flex items-center justify-between mb-6">
        <Tabs value={activePage} onValueChange={setActivePage}>
          <TabsList className="bg-[#111111] border border-white/8 rounded-none p-1 h-auto flex flex-wrap">
            {PAGES.map(function(p) { return (
              <TabsTrigger key={p.key} value={p.key} className="rounded-none data-[state=active]:bg-[#DC143C] data-[state=active]:text-white text-[#A1A1AA] text-xs uppercase tracking-wider px-3 py-1.5" data-testid={'content-tab-' + p.key}>
                {p.label}
              </TabsTrigger>
            ); })}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <a href={PAGES.find(function(p) { return p.key === activePage; })?.path || '/'} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 h-9 px-4 text-xs uppercase tracking-wider text-[#A1A1AA] border border-white/15 hover:border-white/30 hover:text-[#F5F5F0] transition-colors" data-testid="content-preview-btn">
            <ExternalLink className="w-3.5 h-3.5" /> Preview
          </a>
          <button type="button" onClick={handleSeed} disabled={saving} className="inline-flex items-center gap-1.5 h-9 px-4 text-xs uppercase tracking-wider text-[#71717A] border border-white/8 hover:border-white/20 hover:text-[#A1A1AA] transition-colors" title="Re-seed all pages with defaults" data-testid="content-reseed-btn">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Re-seed'}
          </button>
          <Button onClick={handleSave} disabled={saving || !editing} className="bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none h-9 px-5 text-xs uppercase tracking-wider" data-testid="content-save-btn">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Save className="w-3.5 h-3.5 mr-1.5" /> Save</>}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {sectionKeys.map(function(sKey) {
          return <SectionPanel key={sKey} name={sKey} data={editing[sKey]} onUpdate={updateField} basePath={sKey} />;
        })}
      </div>
    </div>
  );
}

function SectionPanel(props) {
  var name = props.name;
  var data = props.data;
  var onUpdate = props.onUpdate;
  var basePath = props.basePath;
  var ref = useState(false);
  var open = ref[0];
  var setOpen = ref[1];

  var summary = Array.isArray(data) ? data.length + ' items' : typeof data === 'object' && data ? Object.keys(data).length + ' fields' : '';

  return (
    <div className="bg-[#111111] border border-white/8">
      <button type="button" onClick={function() { setOpen(!open); }} className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.02] transition-colors" data-testid={'section-toggle-' + name}>
        <span className="text-xs uppercase tracking-[0.15em] text-[#A1A1AA] font-semibold">{name.replace(/_/g, ' ')}</span>
        <span className="flex items-center gap-2 text-[10px] text-[#71717A]">
          {summary}
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          {renderValue(data, basePath, onUpdate)}
        </div>
      )}
    </div>
  );
}

function renderValue(val, path, onUpdate) {
  if (typeof val === 'string') {
    if (val.length > 80) {
      return <Textarea value={val} onChange={function(e) { onUpdate(path, e.target.value); }} className="bg-[#0A0A0A] border-white/10 text-[#F5F5F0] rounded-none text-sm min-h-[60px]" />;
    }
    return <Input value={val} onChange={function(e) { onUpdate(path, e.target.value); }} className="bg-[#0A0A0A] border-white/10 text-[#F5F5F0] rounded-none text-sm h-8" />;
  }

  if (typeof val === 'number') {
    return <Input type="number" value={val} onChange={function(e) { onUpdate(path, Number(e.target.value)); }} className="bg-[#0A0A0A] border-white/10 text-[#F5F5F0] rounded-none text-sm h-8 w-32" />;
  }

  if (Array.isArray(val)) {
    return renderArray(val, path, onUpdate);
  }

  if (typeof val === 'object' && val !== null) {
    return renderObject(val, path, onUpdate);
  }

  return null;
}

function renderArray(arr, path, onUpdate) {
  var addItem = function() {
    var template = arr.length > 0 ? emptyClone(arr[0]) : '';
    onUpdate(path, arr.concat([template]));
  };
  var removeItem = function(i) {
    onUpdate(path, arr.filter(function(_, idx) { return idx !== i; }));
  };

  if (arr.length === 0 || typeof arr[0] === 'string') {
    return (
      <div className="space-y-1">
        {arr.map(function(item, i) {
          return (
            <div key={i} className="flex gap-2 items-center">
              <span className="text-[10px] text-[#71717A] font-mono w-5 shrink-0">{i + 1}</span>
              <Input value={item} onChange={function(e) { onUpdate(path + '.' + i, e.target.value); }} className="bg-[#0A0A0A] border-white/10 text-[#F5F5F0] rounded-none text-sm h-8 flex-1" />
              <button type="button" onClick={function() { removeItem(i); }} className="text-[#52525B] hover:text-red-500 transition-colors shrink-0"><Trash2 className="w-3 h-3" /></button>
            </div>
          );
        })}
        <button type="button" onClick={addItem} className="flex items-center gap-1 text-[10px] text-[#52525B] hover:text-[#A1A1AA] transition-colors mt-1">
          <Plus className="w-3 h-3" /> Add item
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {arr.map(function(item, i) {
        if (typeof item !== 'object' || item === null) return null;
        return (
          <div key={i} className="bg-[#0A0A0A] border border-white/5 p-3 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-[#71717A] font-mono">#{i + 1}</span>
              <button onClick={function() { removeItem(i); }} className="text-[#52525B] hover:text-red-500 transition-colors"><Trash2 className="w-3 h-3" /></button>
            </div>
            {Object.entries(item).map(function(entry) {
              var k = entry[0];
              var v = entry[1];
              var fieldPath = path + '.' + i + '.' + k;
              return (
                <div key={k}>
                  <Label className="text-[10px] text-[#71717A] uppercase tracking-wider">{k.replace(/_/g, ' ')}</Label>
                  {Array.isArray(v) ? (
                    typeof v[0] === 'string' || v.length === 0
                      ? <Textarea value={v.join('\n')} onChange={function(e) { onUpdate(fieldPath, e.target.value.split('\n').filter(Boolean)); }} className="bg-[#050505] border-white/10 text-[#F5F5F0] rounded-none text-xs min-h-[40px] mt-0.5" />
                      : <div className="mt-0.5">{renderArray(v, fieldPath, onUpdate)}</div>
                  ) : typeof v === 'object' && v !== null ? (
                    <div className="mt-0.5 pl-2 border-l border-white/5">{renderObject(v, fieldPath, onUpdate)}</div>
                  ) : typeof v === 'string' && v.length > 80 ? (
                    <Textarea value={v} onChange={function(e) { onUpdate(fieldPath, e.target.value); }} className="bg-[#050505] border-white/10 text-[#F5F5F0] rounded-none text-xs min-h-[40px] mt-0.5" />
                  ) : (
                    <Input value={v != null ? String(v) : ''} onChange={function(e) { onUpdate(fieldPath, e.target.value); }} className="bg-[#050505] border-white/10 text-[#F5F5F0] rounded-none text-sm h-7 mt-0.5" />
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
      <button onClick={addItem} className="flex items-center gap-1.5 text-[10px] text-[#52525B] hover:text-[#A1A1AA] border border-white/5 hover:border-white/15 px-3 py-2 w-full transition-colors">
        <Plus className="w-3 h-3" /> Add item
      </button>
    </div>
  );
}

function renderObject(obj, path, onUpdate) {
  return (
    <div className="space-y-3">
      {Object.entries(obj).map(function(entry) {
        var k = entry[0];
        var v = entry[1];
        var fieldPath = path + '.' + k;

        if (Array.isArray(v)) {
          return (
            <div key={k} className="border-l-2 border-white/5 pl-3">
              <Label className="text-[10px] text-[#DC143C] uppercase tracking-wider font-semibold mb-1 block">{k.replace(/_/g, ' ')} ({v.length})</Label>
              {renderArray(v, fieldPath, onUpdate)}
            </div>
          );
        }

        if (typeof v === 'object' && v !== null) {
          return (
            <div key={k} className="border-l-2 border-white/5 pl-3">
              <Label className="text-[10px] text-[#DC143C] uppercase tracking-wider font-semibold mb-1 block">{k.replace(/_/g, ' ')}</Label>
              {renderObject(v, fieldPath, onUpdate)}
            </div>
          );
        }

        return (
          <div key={k}>
            <Label className="text-[10px] text-[#71717A] uppercase tracking-wider">{k.replace(/_/g, ' ')}</Label>
            {typeof v === 'string' && v.length > 80 ? (
              <Textarea value={v} onChange={function(e) { onUpdate(fieldPath, e.target.value); }} className="bg-[#0A0A0A] border-white/10 text-[#F5F5F0] rounded-none text-sm min-h-[60px] mt-0.5" data-testid={'field-' + k} />
            ) : (
              <Input value={v != null ? String(v) : ''} onChange={function(e) { onUpdate(fieldPath, e.target.value); }} className="bg-[#0A0A0A] border-white/10 text-[#F5F5F0] rounded-none text-sm h-8 mt-0.5" data-testid={'field-' + k} />
            )}
          </div>
        );
      })}
    </div>
  );
}
