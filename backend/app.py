from flask import Flask, jsonify
from flask_cors import CORS
from database import init_db, init_app
from data.routes import bp as data_bp
from strategies.routes import bp as strategies_bp
from backtest.routes import bp as backtest_bp


def create_app():
    app = Flask(__name__)
    CORS(app, origins=["http://localhost:5173", "http://127.0.0.1:5173"])

    init_db()
    init_app(app)

    app.register_blueprint(data_bp)
    app.register_blueprint(strategies_bp)
    app.register_blueprint(backtest_bp)

    @app.get("/api/ping")
    def ping():
        return jsonify({"status": "ok"})

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5001, threaded=True)
