# Changelog

## v1.2
  * No breaking changes
  * Binary support
    * arraybuffer
      * implicit binary views
    * blobs

## v1.1

  * Drasticially reduced the client-side file size 
    * 20kb down to 4.5kb
    * 4kb down to 1.47kb minified and gzipped
  * Simplified API
    * On the client
      * Additional `Funnel` method on a `websocket-pull-stream` wrapped socket
          * Straightforward way to create `pull-stream` Sink 
    * On the server
      * Seamless compatibility with Node-streams
      * Simply `pipe` from a Node stream into a websocket-pull-stream and everything Just Works.
    * On both
      * Addition convenience `Tunnel` that makes through 
        streams extremely trivial to create.
  * No need to require `pull-stream` / `pull-core`
    * `Sink`, `Through`, `Source` can all be accessed through
      the `websocket-pull-stream` exported object 
  * Client side uses `pull-core` instead of `pull-stream`
    * This is why the file size has dropped
    * It means we don't have the utilities included with
      `pull-stream` but if we wish to use things like
      an asynchronous map function in the client, there
      should be a conscious decision to add it independently.
    * These utilities are still available on the server