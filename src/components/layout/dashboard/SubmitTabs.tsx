import React from 'react';
import { FormField, INPUT_CLASS, TAB_TITLE_CLASS } from './fields';
import type { DomainForm, ForumForm, NewsForm, PodcastForm, StreamForm } from '../../../lib/dashboardRows';

interface TabProps<T> {
  form: T;
  onChange: (patch: Partial<T>) => void;
  onSubmit: () => void;
}

const NEWS_CATEGORIES = ['Official', 'Leaks', 'Rumors', 'Community'];

export function SubmitNewsTab({ form, onChange, onSubmit }: TabProps<NewsForm>) {
  return (
    <div className="flex flex-col gap-5 max-w-[650px]">
      <div className={TAB_TITLE_CLASS}>Submit News Broadcast</div>
      <div className="flex flex-col gap-4">
        <FormField label="Headline">
          <input type="text" value={form.title} onChange={e => onChange({ title: e.target.value })} className={INPUT_CLASS} placeholder="Trailer 3 Release Date Leaked!" />
        </FormField>
        <FormField label="Story Body">
          <textarea value={form.body} onChange={e => onChange({ body: e.target.value })} rows={5} className={INPUT_CLASS} placeholder="Full breakdown of the leak, dispatch, or rumor..." />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Category Tag">
            <select value={form.tag} onChange={e => onChange({ tag: e.target.value })} className={INPUT_CLASS}>
              {NEWS_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </FormField>
          <FormField label="Source Platform / Name">
            <input type="text" value={form.src} onChange={e => onChange({ src: e.target.value })} className={INPUT_CLASS} placeholder="Reddit @_arthur1781" />
          </FormField>
        </div>
        <FormField label="Source URL Link">
          <input type="text" value={form.url} onChange={e => onChange({ url: e.target.value })} className={INPUT_CLASS} placeholder="https://x.com/username/status/..." />
        </FormField>
        <div className="grid grid-cols-2 gap-4 items-center">
          <FormField label="Importance Rating">
            <div className="flex items-center gap-1.5 bg-[#050508] border border-white/10 rounded p-3">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onChange({ stars: n === form.stars ? 0 : n })}
                  className="transition-colors"
                >
                  <span className={n <= form.stars ? 'text-neonOrange' : 'text-gray-700'}>★</span>
                </button>
              ))}
            </div>
          </FormField>
          <div className="flex items-center gap-2.5 pt-5">
            <input type="checkbox" id="newsFeatured" checked={form.featured} onChange={e => onChange({ featured: e.target.checked })} className="w-4 h-4 accent-neonOrange" />
            <label htmlFor="newsFeatured" className="text-[10px] text-gray-500 uppercase tracking-widest">Pin as Featured / Top Story</label>
          </div>
        </div>
        <button onClick={onSubmit} className="btn-neon font-orbitron text-xs mt-3 uppercase">Publish News</button>
      </div>
    </div>
  );
}

export function SubmitForumTab({ form, onChange, onSubmit }: TabProps<ForumForm>) {
  return (
    <div className="flex flex-col gap-5">
      <div className={TAB_TITLE_CLASS}>Create New Forum Discussion</div>
      <div className="flex flex-col gap-4">
        <FormField label="Topic Title">
          <input type="text" value={form.title} onChange={e => onChange({ title: e.target.value })} className={INPUT_CLASS} placeholder="GTA VI Map compared to Red Dead Redemption 2" />
        </FormField>
        <FormField label="Discussion Body Content">
          <textarea value={form.body} onChange={e => onChange({ body: e.target.value })} rows={10} className={`${INPUT_CLASS} font-mono`} placeholder="Stitch your evidence, coordinate maps, or share rumors..." />
        </FormField>
        <button onClick={onSubmit} className="btn-neon font-orbitron text-xs mt-2 uppercase">Publish Topic</button>
      </div>
    </div>
  );
}

export function SubmitStreamTab({ form, onChange, onSubmit }: TabProps<StreamForm>) {
  return (
    <div className="flex flex-col gap-5 max-w-[650px]">
      <div className={TAB_TITLE_CLASS}>Submit Community Streamer</div>
      <div className="flex flex-col gap-4">
        <FormField label="Channel Name Alias">
          <input type="text" value={form.name} onChange={e => onChange({ name: e.target.value })} className={INPUT_CLASS} placeholder="GTASeriesVideos" />
        </FormField>
        <FormField label="Platform (e.g. YouTube, Twitch)">
          <input type="text" value={form.plat} onChange={e => onChange({ plat: e.target.value })} className={INPUT_CLASS} placeholder="YouTube / Twitch" />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="YouTube URL Link">
            <input type="text" value={form.yt} onChange={e => onChange({ yt: e.target.value })} className={INPUT_CLASS} placeholder="https://youtube.com/@channel" />
          </FormField>
          <FormField label="Twitch URL Link">
            <input type="text" value={form.tw} onChange={e => onChange({ tw: e.target.value })} className={INPUT_CLASS} placeholder="https://twitch.tv/channel" />
          </FormField>
        </div>
        <FormField label="Channel Brief Description">
          <textarea value={form.desc} onChange={e => onChange({ desc: e.target.value })} rows={3} className={INPUT_CLASS} placeholder="Analyzes GTA 6 files, coordinate triangulation, and community gameplay leaks..." />
        </FormField>
        <button onClick={onSubmit} className="btn-neon font-orbitron text-xs mt-2 uppercase">Submit Streamer</button>
      </div>
    </div>
  );
}

export function SubmitPodcastTab({ form, onChange, onSubmit }: TabProps<PodcastForm>) {
  return (
    <div className="flex flex-col gap-5 max-w-[650px]">
      <div className={TAB_TITLE_CLASS}>Submit Community Podcast</div>
      <div className="flex flex-col gap-4">
        <FormField label="Show Name Title">
          <input type="text" value={form.name} onChange={e => onChange({ name: e.target.value })} className={INPUT_CLASS} placeholder="Radio Leonida" />
        </FormField>
        <FormField label="Audio Stream URL Link">
          <input type="text" value={form.url} onChange={e => onChange({ url: e.target.value })} className={INPUT_CLASS} placeholder="https://soundcloud.com/show-link" />
        </FormField>
        <FormField label="Show Description Details">
          <textarea value={form.desc} onChange={e => onChange({ desc: e.target.value })} rows={4} className={INPUT_CLASS} placeholder="Weekly deep dives on Leonida mapping, Florida Joker parodies, and GTA VI developer insights..." />
        </FormField>
        <button onClick={onSubmit} className="btn-neon font-orbitron text-xs mt-2 uppercase">Submit Podcast</button>
      </div>
    </div>
  );
}

export function SubmitDomainTab({ form, onChange, onSubmit }: TabProps<DomainForm>) {
  return (
    <div className="flex flex-col gap-5 max-w-[650px]">
      <div className={TAB_TITLE_CLASS}>List Web3 Domain for Sale</div>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Domain Name">
            <input type="text" value={form.name} onChange={e => onChange({ name: e.target.value })} className={INPUT_CLASS} placeholder="vicecity.nft" />
          </FormField>
          <FormField label="Asking Price (USD Equivalency)">
            <input type="number" value={form.price} onChange={e => onChange({ price: e.target.value })} className={INPUT_CLASS} placeholder="1500" />
          </FormField>
        </div>
        <FormField label="Domain Value Description">
          <textarea value={form.desc} onChange={e => onChange({ desc: e.target.value })} rows={4} className={INPUT_CLASS} placeholder="Premium Web3 domain on Unstoppable Domains, highly memorable brand for GTA VI guilds." />
        </FormField>
        <button onClick={onSubmit} className="btn-neon font-orbitron text-xs mt-2 uppercase">List Domain</button>
      </div>
    </div>
  );
}
