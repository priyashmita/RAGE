import { useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, Upload, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ragerAuthHeader } from '@/lib/ragerAuth';

const IMGBB_KEY = process.env.REACT_APP_IMGBB_API_KEY;

async function uploadToImgbb(file) {
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const form = new FormData();
  form.append('key', IMGBB_KEY);
  form.append('image', base64);
  const res = await axios.post('https://api.imgbb.com/1/upload', form);
  return res.data.data.url;
}

const BACKEND = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

const CATEGORIES = [
  'Finance & Fundraising',
  'Legal & Compliance',
  'Marketing & Brand',
  'Operations & Scale',
  'Technology & Product',
  'Strategy & Growth',
  'People & Culture',
  'Sales & Distribution',
  'Media & Communications',
  'International Expansion',
];

function ExpertiseCheckboxes({ value, onChange }) {
  const toggle = (cat) => {
    if (value.includes(cat)) {
      onChange(value.filter(c => c !== cat));
    } else {
      onChange([...value, cat]);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      {CATEGORIES.map(cat => (
        <label key={cat} className="flex items-center gap-2 cursor-pointer select-none group">
          <input
            type="checkbox"
            checked={value.includes(cat)}
            onChange={() => toggle(cat)}
            className="w-4 h-4 accent-[#DC143C] border-white/20 flex-shrink-0"
          />
          <span className="text-xs text-[#A1A1AA] group-hover:text-[#F5F5F0] transition-colors">
            {cat}
          </span>
        </label>
      ))}
    </div>
  );
}

export default function RagerProfilePage() {
  const { rager, setRager } = useOutletContext();

  const [form, setForm] = useState({
    title:        rager.title        || '',
    company:      rager.company      || '',
    bio:          rager.bio          || '',
    location:     rager.location     || '',
    linkedin:     rager.linkedin     || '',
    photo_url:    rager.photo_url    || '',
    availability: rager.availability || 'available',
    categories:   rager.categories   || [],
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const set = (field) => (e) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await axios.put(
        `${BACKEND}/api/rager/profile`,
        form,
        { headers: ragerAuthHeader() }
      );
      setRager(res.data);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-[#DC143C] mb-1">Rager Portal</p>
        <h1 className="text-2xl font-light text-[#F5F5F0]">My Profile</h1>
        <p className="text-sm text-[#52525B] mt-1">
          Keep your profile accurate — it's used when matching you to founders.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-[#111111] border border-white/8 p-6">
        {/* Name (display only — managed by admin) */}
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1 block">Name</Label>
          <p className="text-sm text-[#A1A1AA]">{rager.name}</p>
          <p className="text-[10px] text-[#3F3F46] mt-0.5">Contact the RAGE team to update your name</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1 block">Title</Label>
            <Input
              value={form.title}
              onChange={set('title')}
              placeholder="e.g. Partner"
              className="bg-[#0A0A0A] border-white/10 text-[#F5F5F0] h-9 rounded-none text-sm"
            />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1 block">Company</Label>
            <Input
              value={form.company}
              onChange={set('company')}
              placeholder="e.g. Sequoia Capital"
              className="bg-[#0A0A0A] border-white/10 text-[#F5F5F0] h-9 rounded-none text-sm"
            />
          </div>
        </div>

        <div>
          <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1 block">Bio</Label>
          <textarea
            value={form.bio}
            onChange={set('bio')}
            rows={4}
            placeholder="A short description of your expertise and background"
            className="w-full bg-[#0A0A0A] border border-white/10 text-[#F5F5F0] text-sm px-3 py-2 focus:outline-none focus:border-[#DC143C]/40 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1 block">Location</Label>
            <Input
              value={form.location}
              onChange={set('location')}
              placeholder="e.g. Mumbai"
              className="bg-[#0A0A0A] border-white/10 text-[#F5F5F0] h-9 rounded-none text-sm"
            />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1 block">Availability</Label>
            <select
              value={form.availability}
              onChange={set('availability')}
              className="w-full bg-[#0A0A0A] border border-white/10 text-[#F5F5F0] text-sm px-3 py-2 h-9 focus:outline-none focus:border-[#DC143C]/40"
            >
              <option value="available">Available</option>
              <option value="limited">Limited</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </div>
        </div>

        <div>
          <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1 block">LinkedIn URL</Label>
          <Input
            value={form.linkedin}
            onChange={set('linkedin')}
            placeholder="https://linkedin.com/in/..."
            className="bg-[#0A0A0A] border-white/10 text-[#F5F5F0] h-9 rounded-none text-sm"
          />
        </div>

        <div>
          <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-2 block">Photo</Label>
          <div className="flex items-center gap-4">
            {/* Preview */}
            <div className="w-14 h-14 border border-white/10 shrink-0 overflow-hidden bg-[#0A0A0A] flex items-center justify-center">
              {form.photo_url ? (
                <img
                  src={form.photo_url}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={e => { e.target.style.display = 'none'; }}
                />
              ) : (
                <span className="text-[#3F3F46] text-xs">No photo</span>
              )}
            </div>
            {/* Buttons */}
            <div className="flex flex-col gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (!IMGBB_KEY) { toast.error('Image upload not configured'); return; }
                  setUploading(true);
                  try {
                    const url = await uploadToImgbb(file);
                    setForm(f => ({ ...f, photo_url: url }));
                    toast.success('Photo uploaded');
                  } catch {
                    toast.error('Upload failed — try again');
                  } finally {
                    setUploading(false);
                    e.target.value = '';
                  }
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-[#A1A1AA] border border-white/10 hover:border-white/25 hover:text-[#F5F5F0] transition-colors disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                {uploading ? 'Uploading…' : 'Upload photo'}
              </button>
              {form.photo_url && (
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, photo_url: '' }))}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-[#71717A] hover:text-[#DC143C] transition-colors"
                >
                  <X className="w-3 h-3" /> Remove
                </button>
              )}
            </div>
          </div>
        </div>

        <div>
          <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-2 block">
            Expertise Areas
          </Label>
          <ExpertiseCheckboxes
            value={form.categories}
            onChange={(cats) => setForm(f => ({ ...f, categories: cats }))}
          />
        </div>

        <Button
          type="submit"
          disabled={saving}
          className="w-full h-10 bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none text-xs uppercase tracking-wider"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Profile'}
        </Button>
      </form>
    </main>
  );
}
