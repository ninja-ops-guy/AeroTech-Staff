"""Disposable real Command Station fixture; never reads the owner's station data."""
import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(sys.argv[1]).resolve()))
from residual.station.service import Station, demo_spec
from residual.station.server import Server

with tempfile.TemporaryDirectory(prefix="aerotech-qualification-") as root:
    station = Station(root)
    project_id = station.create(demo_spec(), demo=True)["project_id"]
    station.triage(project_id)
    station.run_one(project_id, "OPS-101")
    station.review(project_id, "OPS-101")
    station.integrate(project_id, "OPS-101")
    station.run_one(project_id, "OPS-102")
    station.review(project_id, "OPS-102")
    server = Server(("127.0.0.1", 0), station)
    print(json.dumps({"url": f"http://127.0.0.1:{server.server_port}", "project_id": project_id}), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
