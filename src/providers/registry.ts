import { ANIME, MANGA, MOVIES, META, LIGHT_NOVELS, COMICS, NEWS } from '@consumet/extensions'
import { RUNTIME } from '../config/constants.js'

export const animeProviders = {
  hianime: new ANIME.Hianime(),
  animepahe: new ANIME.AnimePahe(),
  animekai: new ANIME.AnimeKai(),
  kickassanime: new ANIME.KickAssAnime(),
  animesaturn: new ANIME.AnimeSaturn(),
  animeunity: new ANIME.AnimeUnity(),
  animesama: new ANIME.AnimeSama(),
}

export const mangaProviders = {
  mangadex: new MANGA.MangaDex(),
  comick: new MANGA.ComicK(),
  mangahere: new MANGA.MangaHere(),
  mangapill: new MANGA.MangaPill(),
  mangareader: new MANGA.MangaReader(),
  asurascans: new MANGA.AsuraScans(),
  weebcentral: new MANGA.WeebCentral(),
  mangakakalot: new MANGA.MangaKakalot(),
}

export const movieProviders = {
  flixhq: new MOVIES.FlixHQ(),
  goku: new MOVIES.Goku(),
  sflix: new MOVIES.SFlix(),
  himovies: new MOVIES.HiMovies(),
  dramacool: new MOVIES.DramaCool(),
  turkish: new MOVIES.Turkish(),
}

export const novelProviders = {
  novelupdates: new LIGHT_NOVELS.NovelUpdates(),
}

export const comicProviders = {
  getcomics: new COMICS.GetComics(),
}

export const newsProviders = {
  ann: new NEWS.ANN(),
}

export const metaProviders = {
  anilist: new META.Anilist(animeProviders.hianime as any),
  anilistManga: new META.Anilist.Manga(mangaProviders.mangadex as any),
  mal: new META.Myanimelist(animeProviders.hianime as any),
  tmdb: new META.TMDB(RUNTIME.tmdbKey || undefined, movieProviders.flixhq as any),
}

export const ANIME_KEYS = Object.keys(animeProviders) as Array<keyof typeof animeProviders>
export const MANGA_KEYS = Object.keys(mangaProviders) as Array<keyof typeof mangaProviders>
export const MOVIE_KEYS = Object.keys(movieProviders) as Array<keyof typeof movieProviders>
export const NOVEL_KEYS = Object.keys(novelProviders) as Array<keyof typeof novelProviders>
export const COMIC_KEYS = Object.keys(comicProviders) as Array<keyof typeof comicProviders>

export type AnimeKey = keyof typeof animeProviders
export type MangaKey = keyof typeof mangaProviders
export type MovieKey = keyof typeof movieProviders
export type NovelKey = keyof typeof novelProviders
export type ComicKey = keyof typeof comicProviders

export function pickAnime(name?: string) {
  const key = (name?.toLowerCase() ?? 'hianime') as AnimeKey
  return animeProviders[key] ?? animeProviders.hianime
}

export function pickManga(name?: string) {
  const key = (name?.toLowerCase() ?? 'mangadex') as MangaKey
  return mangaProviders[key] ?? mangaProviders.mangadex
}

export function pickMovie(name?: string) {
  const key = (name?.toLowerCase() ?? 'flixhq') as MovieKey
  return movieProviders[key] ?? movieProviders.flixhq
}

export function pickNovel(name?: string) {
  const key = (name?.toLowerCase() ?? 'novelupdates') as NovelKey
  return novelProviders[key] ?? novelProviders.novelupdates
}
