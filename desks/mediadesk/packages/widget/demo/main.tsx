/**
 * 위젯 데모 진입점. 폼 입력을 읽어 <MediaUploader> + <MediaGallery> 를 (재)마운트한다.
 * 소스(src/*.tsx)를 직접 import 하므로 빌드 산출물 없이도 동작한다.
 * 업로드 성공 시 갤러리 ref.refresh() 로 즉시 새로고침.
 */
import { StrictMode, useRef, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { createRoot } from 'react-dom/client'

import { MediaGallery, type MediaGalleryHandle } from '../src/MediaGallery'
import { MediaUploader } from '../src/MediaUploader'

function readInput(id: string): string {
  return (document.getElementById(id) as HTMLInputElement | null)?.value ?? ''
}

function Demo(): ReactElement {
  const [config, setConfig] = useState({
    publishableKey: 'pk_demo',
    endpoint: 'http://localhost:4191',
    folder: 'demo',
    nonce: 0,
  })
  const galleryRef = useRef<MediaGalleryHandle>(null)

  const sync = () =>
    setConfig((c) => ({
      publishableKey: readInput('pk') || 'pk_demo',
      endpoint: readInput('endpoint') || 'http://localhost:4191',
      folder: readInput('folder') || 'demo',
      nonce: c.nonce + 1,
    }))

  if (typeof window !== 'undefined' && !(window as { __mdBound?: boolean }).__mdBound) {
    ;(window as { __mdBound?: boolean }).__mdBound = true
    for (const id of ['pk', 'endpoint', 'folder']) {
      document.getElementById(id)?.addEventListener('change', sync)
    }
  }

  const uploaderHost = document.getElementById('uploader')
  const galleryHost = document.getElementById('gallery')

  return (
    <>
      {uploaderHost
        ? createPortal(
            <MediaUploader
              key={`u-${config.nonce}`}
              publishableKey={config.publishableKey}
              endpoint={config.endpoint}
              folder={config.folder}
              onUploaded={(a) => {
                console.info('[demo] uploaded', a)
                galleryRef.current?.refresh()
              }}
              onError={(e) => console.warn('[demo] upload error', e)}
            />,
            uploaderHost
          )
        : null}
      {galleryHost
        ? createPortal(
            <MediaGallery
              key={`g-${config.nonce}`}
              ref={galleryRef}
              publishableKey={config.publishableKey}
              endpoint={config.endpoint}
              folder={config.folder}
            />,
            galleryHost
          )
        : null}
    </>
  )
}

const root = document.createElement('div')
document.body.appendChild(root)
createRoot(root).render(
  <StrictMode>
    <Demo />
  </StrictMode>
)
